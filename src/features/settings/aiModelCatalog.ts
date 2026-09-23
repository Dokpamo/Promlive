import {loadXaiCatalog} from '../../adapters/ai/xaiCatalog';
import {loadProviderCatalog} from '../../adapters/ai/providerCatalog';
import {AiCatalogError, type AiCatalogKind} from '../../ports/aiCatalog';
import {connectionModels, connectionRoute, connectionRoutes, type AiConnectionPreview, type AiModelPreview, type AiServicePreview} from './aiSettingsModel';
import {officialCatalogKinds, officialModels} from './aiOfficialCatalog';

export type AiModelLoader = (service: AiServicePreview, connection: AiConnectionPreview, signal: AbortSignal, kind?: AiCatalogKind) => Promise<AiModelPreview[]>;
export const catalogLabels: Record<AiCatalogKind, string> = {chat: '대화 모델', image: '이미지 생성 모델', video: '영상 생성 모델', audio: '음성 모델', voice: '음성 읽기 목소리'};
const modalities: Record<string, string> = {text: '텍스트', image: '이미지', video: '영상', audio: '음성'};

export const loadAiModels: AiModelLoader = async (service, connection, signal, kind = 'chat') => {
  if (!connectionRoutes(service).some(route => route.id === connection.routeId) || connectionRoute(service, connection).auth === 'oauth') throw new AiCatalogError('connection');
  const entries = service.id === 'xai' ? await loadXaiCatalog(connection, kind, signal) : await loadProviderCatalog(service.id, connection, kind, signal);
  const documented = defaultCatalog(service, connection, kind);
  return entries.map(entry => {
    const known = documented.find(model => model.id === entry.id || entry.aliases.includes(model.id));
    const input = entry.inputModalities.map(value => modalities[value] ?? value).join('·');
    const output = entry.outputModalities.map(value => modalities[value] ?? value).join('·');
    return {
      ...known, id: entry.id, name: known?.name ?? entry.name,
      detail: kind === 'voice' ? entry.id : [input && `${input} 입력`, output && `${output} 출력`, entry.contextLength && `문맥 ${entry.contextLength.toLocaleString()} 토큰`].filter(Boolean).join(' · ') || catalogLabels[kind],
      effort: entry.reasoningEfforts ?? known?.effort ?? [], tools: entry.tools ?? known?.tools ?? [], source: 'api',
      ...(entry.defaultReasoningEffort ? {defaultEffort: entry.defaultReasoningEffort} : {}),
      ...(entry.maxOutputTokens ? {maxOutputTokens: entry.maxOutputTokens} : {}),
      ...(entry.thinking !== undefined ? {thinking: entry.thinking} : {}),
      ...(entry.adaptiveThinking !== undefined ? {adaptiveThinking: entry.adaptiveThinking} : {}),
      ...(entry.parameters ? {sampling: entry.parameters.includes('temperature'), stop: entry.parameters.includes('stop'), verbosity: entry.parameters.includes('verbosity')} : {}),
    };
  });
};

export function catalogKinds(service: AiServicePreview, connection: AiConnectionPreview): AiCatalogKind[] {
  if (connectionRoute(service, connection).auth === 'oauth') return ['chat'];
  return officialCatalogKinds(service.id);
}

export function defaultCatalog(service: AiServicePreview, connection: AiConnectionPreview, kind: AiCatalogKind): AiModelPreview[] {
  const route = connectionRoute(service, connection);
  if (route.auth === 'oauth') return kind === 'chat' ? connectionModels(service, connection) : [];
  return officialModels(service.id, kind);
}

/** New IDs lead; surviving rows retain the user's familiar order. Removed rows never become selectable ghosts. */
export function reconcileCatalog(previous: AiModelPreview[], incoming: AiModelPreview[]): AiModelPreview[] {
  const next = new Map(incoming.map(model => [model.id, model]));
  const oldIds = new Set(previous.map(model => model.id));
  return [...next.values()].filter(model => !oldIds.has(model.id)).concat(previous.flatMap(model => next.has(model.id) ? [next.get(model.id)!] : []));
}
