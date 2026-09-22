import {expect, it, vi} from 'vitest';
import {repository} from './helpers';
import {aiServices, chooseConnectionRoute, chooseMediaModel, choosePreviewModel, createAiSettingsPreview, modelPresetCapabilities} from '../src/features/settings/aiSettingsModel';
import {aiPreferencesKey, AiSettingsPreferences, restoreAiPreferences, serializeAiPreferences} from '../src/features/settings/aiSettingsPreferences';
import type {CredentialStore} from '../src/ports/ai';

function credentialFixture() {
  const values = new Map<string, string>();
  const store: CredentialStore = {
    get: vi.fn(async reference => values.get(reference) ?? null),
    set: vi.fn(async (reference, secret) => {values.set(reference, secret);}),
    remove: vi.fn(async reference => {values.delete(reference);}),
  };
  return store;
}

it('restores live model capabilities and media selections separately without storing keys', () => {
  const state = createAiSettingsPreview();
  const model = {id: 'api-only-model', name: 'API model', detail: '텍스트', effort: ['high'], tools: [], source: 'api' as const};
  let connection = choosePreviewModel('xai', {...state.connections.xai, key: 'not-for-storage'}, model);
  connection = chooseMediaModel(connection, 'image', {...model, id: 'image-from-api'});
  connection = chooseMediaModel(connection, 'video', {...model, id: 'video-from-api'});
  connection = chooseMediaModel(connection, 'voice', {...model, id: 'ara', name: 'Ara'});
  expect(connection.model).toBe('api-only-model');
  state.connections.xai = connection;
  const raw = serializeAiPreferences(state);
  expect(raw).not.toContain('not-for-storage');
  const restored = restoreAiPreferences(raw).connections.xai;
  expect(restored.media).toEqual({image: 'image-from-api', video: 'video-from-api', audio: '', voice: 'ara', voiceName: 'Ara'});
  expect(restored.catalogModel).toEqual(model);
  expect(modelPresetCapabilities(aiServices.find(item => item.id === 'xai')!, restored)).toMatchObject({efforts: ['high'], output: true, tools: false});
});

it('migrates earlier preferences without clearing the selected provider or model', () => {
  const state = createAiSettingsPreview();
  state.connections.xai.model = 'previous-selection';
  const saved = JSON.parse(serializeAiPreferences(state));
  delete saved.connections.xai.media;
  delete saved.connections.xai.catalogModel;
  expect(restoreAiPreferences(JSON.stringify(saved)).connections.xai).toMatchObject({model: 'previous-selection', catalogModel: null, media: {image: '', video: '', voice: '', voiceName: ''}});
});

it('preserves available account previews and migrates removed routes without carrying account state across', () => {
  const state = createAiSettingsPreview();
  for (const id of ['xai', 'minimax', 'qwen'] as const) {
    const api = state.connections[id];
    const {routeId: _route, routes: _routes, ...profile} = api;
    state.connections[id] = {...api, routeId: 'oauth', key: 'account-only-secret', model: 'account-model',
      routes: {api: {...profile, key: 'saved-api-secret', model: 'my-saved-api-model'}}};
  }
  const saved = serializeAiPreferences(state);
  const restored = restoreAiPreferences(saved);
  expect(restored.connections.xai).toMatchObject({routeId: 'oauth', key: '', model: 'account-model'});
  expect(restored.connections.xai.routes.api).toMatchObject({key: '', model: 'my-saved-api-model'});
  for (const id of ['minimax', 'qwen'] as const) {
    expect(restored.connections[id]).toMatchObject({routeId: 'api', key: '', model: 'my-saved-api-model'});
    expect(restored.connections[id].routes).not.toHaveProperty('oauth');
  }
  expect(saved).not.toMatch(/account-only-secret|saved-api-secret/);
});

it('restores API keys for active and inactive routes from separate storage after reopening', async () => {
  const repo = await repository();
  const credentials = credentialFixture();
  try {
    const settings = new AiSettingsPreferences(repo, credentials);
    await settings.load();
    const service = aiServices.find(item => item.id === 'minimax')!;
    settings.update(previous => {
      const api = {...previous.connections.minimax, key: 'test-secret-global'};
      const china = {...chooseConnectionRoute(service, api, 'api-cn'), key: 'test-secret-china'};
      return {...previous, service: 'minimax', appPreset: {length: 'short'}, connections: {...previous.connections, minimax: {...china, modelPresets: {...china.modelPresets, [china.model]: {...china.modelPresets[china.model]!, maxTokens: '8192'}}}}};
    });
    await settings.flush();
    const raw = await repo.getSetting(aiPreferencesKey);
    expect(raw).not.toContain('test-secret');
    expect(raw).not.toContain('"key"');
    expect(settings.snapshot().value.connections.minimax.key).toBe('test-secret-china');

    const reopened = new AiSettingsPreferences(repo, credentials);
    await reopened.load();
    expect(reopened.snapshot().value).toMatchObject({service: 'minimax', appPreset: {length: 'short'}});
    const restored = reopened.snapshot().value.connections.minimax;
    expect(restored).toMatchObject({routeId: 'api-cn', key: 'test-secret-china'});
    expect(restored.modelPresets[restored.model]?.maxTokens).toBe('8192');
    expect(chooseConnectionRoute(service, restored, 'api')).toMatchObject({url: 'https://api.minimax.io/v1', key: 'test-secret-global'});
    expect(reopened.snapshot().value.connections.xai.key).toBe('');
  } finally {await repo.db.close();}
});

it('keeps rapid automatic saves ordered when the first write is slow', async () => {
  let release!: () => void;
  const firstWrite = new Promise<void>(resolve => {release = resolve;});
  let stored: string | undefined;
  const repo = {
    getSetting: async () => undefined,
    setSetting: vi.fn(async (_key: string, value: string) => {if (!stored) await firstWrite; stored = value;}),
  };
  const settings = new AiSettingsPreferences(repo, credentialFixture());
  await settings.load();
  settings.update(previous => ({...previous, appPreset: {length: 'short'}}));
  settings.update(previous => ({...previous, appPreset: {length: 'long'}}));
  await Promise.resolve();
  expect(repo.setSetting).toHaveBeenCalledTimes(1);
  expect(settings.snapshot().value.appPreset.length).toBe('long');
  release();
  await settings.flush();
  expect(restoreAiPreferences(stored).appPreset.length).toBe('long');
  expect(repo.setSetting).toHaveBeenCalledTimes(2);
});

it('keeps a failed save visible and recovers when the next edit is saved', async () => {
  const repo = {getSetting: async () => undefined, setSetting: vi.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined)};
  const settings = new AiSettingsPreferences(repo, credentialFixture());
  await settings.load();
  settings.update(previous => ({...previous, appPreset: {length: 'short'}}));
  await settings.flush();
  expect(settings.snapshot().error).toContain('저장하지 못했어요');
  expect(settings.snapshot().value.appPreset.length).toBe('short');
  settings.update(previous => ({...previous, appPreset: {length: 'long'}}));
  await settings.flush();
  expect(settings.snapshot().error).toBe('');
});

it('opens safely with defaults when saved preferences are damaged or from another format', () => {
  for (const raw of ['{', '{"version":500}', undefined]) {
    const restored = restoreAiPreferences(raw);
    expect(restored.service).toBe('xai');
    expect(restored.connections.xai.key).toBe('');
  }
});

it('keeps the last typed key when secure writes are slow and removes it when the input is cleared', async () => {
  const repo = await repository();
  const credentials = credentialFixture();
  const save = credentials.set;
  let release!: () => void;
  const slowWrite = new Promise<void>(resolve => {release = resolve;});
  credentials.set = vi.fn(async (reference, key) => {await slowWrite; await save(reference, key);});
  const settings = new AiSettingsPreferences(repo, credentials);
  try {
    await settings.load();
    const type = (key: string) => settings.update(previous => ({...previous, connections: {...previous.connections, xai: {...previous.connections.xai, key}}}));
    type('partial');
    type('complete-key');
    await Promise.resolve();
    expect(credentials.set).toHaveBeenCalledTimes(1);
    release();
    await settings.flush();
    const reopened = new AiSettingsPreferences(repo, credentials);
    await reopened.load();
    expect(reopened.snapshot().value.connections.xai.key).toBe('complete-key');
    type('');
    await settings.flush();
    const cleared = new AiSettingsPreferences(repo, credentials);
    await cleared.load();
    expect(cleared.snapshot().value.connections.xai.key).toBe('');
    expect(credentials.remove).toHaveBeenCalledTimes(1);
  } finally {release(); await repo.db.close();}
});

it('does not drop the API key when a provider switches to OAuth and the app restarts', async () => {
  const repo = await repository();
  const credentials = credentialFixture();
  const service = aiServices.find(item => item.id === 'xai')!;
  try {
    const settings = new AiSettingsPreferences(repo, credentials);
    await settings.load();
    settings.update(previous => ({...previous, connections: {...previous.connections,
      xai: chooseConnectionRoute(service, {...previous.connections.xai, key: 'api-key-kept'}, 'oauth'),
    }}));
    await settings.flush();
    const reopened = new AiSettingsPreferences(repo, credentials);
    await reopened.load();
    const connection = reopened.snapshot().value.connections.xai;
    expect(connection).toMatchObject({routeId: 'oauth', key: ''});
    expect(chooseConnectionRoute(service, connection, 'api').key).toBe('api-key-kept');
  } finally {await repo.db.close();}
});

it('reports a secure-store failure and retries the unsaved key on the next edit', async () => {
  const repo = await repository();
  const credentials = credentialFixture();
  const save = credentials.set;
  credentials.set = vi.fn().mockRejectedValueOnce(new Error('locked')).mockImplementation(save);
  try {
    const settings = new AiSettingsPreferences(repo, credentials);
    await settings.load();
    settings.update(previous => ({...previous, connections: {...previous.connections, xai: {...previous.connections.xai, key: 'pending-key'}}}));
    await settings.flush();
    expect(settings.snapshot().error).toContain('저장하지 못했어요');
    settings.update(previous => ({...previous, appPreset: {length: 'short'}}));
    await settings.flush();
    expect(settings.snapshot().error).toBe('');
    const reopened = new AiSettingsPreferences(repo, credentials);
    await reopened.load();
    expect(reopened.snapshot().value.connections.xai.key).toBe('pending-key');
  } finally {await repo.db.close();}
});

it('does not erase saved keys or hide a load failure when an unrelated setting changes', async () => {
  const repo = await repository();
  const credentials = credentialFixture();
  try {
    const initial = new AiSettingsPreferences(repo, credentials);
    await initial.load();
    initial.update(previous => ({...previous, connections: {...previous.connections, xai: {...previous.connections.xai, key: 'previously-saved-key'}}}));
    await initial.flush();
    const locked = new AiSettingsPreferences(repo, {...credentials, get: async () => {throw new Error('locked');}});
    await locked.load();
    locked.update(previous => ({...previous, appPreset: {length: 'long'}}));
    await locked.flush();
    expect(locked.snapshot().error).toContain('불러오지 못했어요');
    expect(credentials.remove).not.toHaveBeenCalled();
    const reopened = new AiSettingsPreferences(repo, credentials);
    await reopened.load();
    expect(reopened.snapshot().value.connections.xai.key).toBe('previously-saved-key');
  } finally {await repo.db.close();}
});
