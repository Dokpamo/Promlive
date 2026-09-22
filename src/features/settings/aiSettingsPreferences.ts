import {z} from 'zod';
import type {StoryRepository} from '../../ports/repository';
import type {CredentialStore} from '../../ports/ai';
import {aiServices, chooseConnectionRoute, connectionRoutes, createAiSettingsPreview, type AiSettingsPreviewState} from './aiSettingsModel';
import {aiModelSchema} from './aiModelSchema';

export const aiPreferencesKey = 'ai:preferences:v1';
const text = z.string();
const presetSchema = z.object({
  effort: text, thinking: text, verbosity: text, maxTokens: text,
  temperature: text, topP: text, stop: text, tools: z.array(z.enum(['web', 'x', 'files', 'code'])),
  routing: text, hosts: text, fallback: z.boolean(), dataPolicy: text,
  inputPrice: text, outputPrice: text, context: text, keepAlive: text,
  filters: z.record(text, text),
});
// Deliberately omit credentials from device preferences, including inactive routes.
const profileSchema = z.object({
  name: text, url: text, model: text, ollamaMode: text, protocol: text, project: text,
  modelPresets: z.record(text, presetSchema),
  catalogModel: aiModelSchema.nullable().default(null),
  media: z.object({image: text, video: text, audio: text.default(''), voice: text, voiceName: text}).default({image: '', video: '', audio: '', voice: '', voiceName: ''}),
});
const connectionSchema = profileSchema.extend({routeId: text, routes: z.record(text, profileSchema)});
const preferencesSchema = z.object({
  version: z.literal(1), service: text,
  appPreset: z.object({length: z.enum(['default', 'short', 'balanced', 'long'])}),
  connections: z.record(text, z.unknown()),
});

export function serializeAiPreferences(value: AiSettingsPreviewState): string {
  return JSON.stringify({version: 1, service: value.service, appPreset: value.appPreset,
    connections: Object.fromEntries(Object.entries(value.connections).map(([id, connection]) => [id, connectionSchema.parse(connection)])),
  });
}

export function restoreAiPreferences(raw: string | undefined): AiSettingsPreviewState {
  const value = createAiSettingsPreview();
  if (!raw) return value;
  try {
    const result = preferencesSchema.safeParse(JSON.parse(raw));
    if (!result.success) return value;
    const saved = result.data;
    value.service = aiServices.find(service => service.id === saved.service)?.id ?? value.service;
    value.appPreset = saved.appPreset;
    for (const service of aiServices) {
      const parsed = connectionSchema.safeParse(saved.connections[service.id]);
      const routes = connectionRoutes(service);
      if (!parsed.success) continue;
      const connection = parsed.data;
      const activeRouteExists = routes.some(route => route.id === connection.routeId);
      const routeId = activeRouteExists ? connection.routeId : routes[0]!.id;
      // Retiring an unsupported login preview must restore the saved API profile,
      // never carry account-only selections or credentials into a different route.
      const profile = activeRouteExists ? connection : connection.routes[routeId] ?? value.connections[service.id];
      value.connections[service.id] = {...profile, routeId, key: '', routes: Object.fromEntries(
        Object.entries(connection.routes).filter(([id]) => routes.some(route => route.id === id)).map(([id, profile]) => [id, {...profile, key: ''}]),
      )};
    }
  } catch { /* Keep usable defaults when an older or damaged preference cannot be read. */ }
  return value;
}

const credentialReference = (service: string, route: string) => `com.promlive.ai.${service}.${route}`;
const usesKey = (auth: string) => auth === 'apiKey' || auth === 'optionalKey';

function apiKeys(value: AiSettingsPreviewState): Map<string, string> {
  const keys = new Map<string, string>();
  for (const service of aiServices) {
    const connection = value.connections[service.id];
    for (const route of connectionRoutes(service)) {
      if (!usesKey(route.auth)) continue;
      const profile = route.id === connection.routeId ? connection : connection.routes[route.id];
      keys.set(credentialReference(service.id, route.id), profile?.key ?? '');
    }
  }
  return keys;
}

/** Lives above the settings modal; every edit is queued in order and survives closing it. */
export class AiSettingsPreferences {
  private state = {value: createAiSettingsPreview(), ready: false, error: ''};
  private listeners = new Set<() => void>();
  private loading: Promise<void> | undefined;
  private saving: Promise<void> = Promise.resolve();
  private savedKeys = new Map<string, string>();
  private unreadKeys = new Set<string>();
  constructor(private readonly repo: Pick<StoryRepository, 'getSetting' | 'setSetting'>, private readonly credentials: CredentialStore) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  private emit() {for (const listener of this.listeners) listener();}
  load() {
    return this.loading ??= this.repo.getSetting(aiPreferencesKey).then(async raw => {
      const value = restoreAiPreferences(raw);
      let error = '';
      await Promise.all(aiServices.map(async service => {
        const connection = value.connections[service.id];
        for (const route of connectionRoutes(service)) {
          if (!usesKey(route.auth)) continue;
          const reference = credentialReference(service.id, route.id);
          try {
            const key = await this.credentials.get(reference) ?? '';
            this.savedKeys.set(reference, key);
            if (route.id === connection.routeId) connection.key = key;
            else if (key || connection.routes[route.id]) {
              const {routeId: _route, routes: _routes, ...profile} = chooseConnectionRoute(service, connection, route.id);
              connection.routes[route.id] = {...profile, key};
            }
          } catch {
            this.unreadKeys.add(reference);
            error = '저장한 API 키를 불러오지 못했어요. 다시 입력해 주세요.';
          }
        }
      }));
      this.state = {value, ready: true, error};
      this.emit();
    }).catch(() => {
      this.state = {...this.state, ready: true, error: '저장한 AI 설정을 불러오지 못했어요.'};
      this.emit();
    });
  }
  update = (action: AiSettingsPreviewState | ((previous: AiSettingsPreviewState) => AiSettingsPreviewState)) => {
    if (!this.state.ready) return;
    const value = typeof action === 'function' ? action(this.state.value) : action;
    const document = serializeAiPreferences(value);
    const keys = apiKeys(value);
    this.state = {...this.state, value};
    this.emit();
    this.saving = this.saving.then(async () => {
      for (const [reference, key] of keys) {
        if (key === (this.savedKeys.get(reference) ?? '')) continue;
        if (key) await this.credentials.set(reference, key);
        else await this.credentials.remove(reference);
        this.savedKeys.set(reference, key);
        this.unreadKeys.delete(reference);
      }
      await this.repo.setSetting(aiPreferencesKey, document);
    }).then(() => {
      const error = this.unreadKeys.size ? '저장한 API 키를 불러오지 못했어요. 다시 입력해 주세요.' : '';
      if (this.state.error !== error) {this.state = {...this.state, error}; this.emit();}
    }).catch(() => {
      this.state = {...this.state, error: 'AI 설정을 저장하지 못했어요. 기기의 저장 공간을 확인해 주세요.'};
      this.emit();
    });
  };
  flush() {return this.saving;}
}
