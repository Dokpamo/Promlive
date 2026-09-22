import {expect, it, vi} from 'vitest';
import {AiCatalogCache, aiCatalogCacheKey, catalogScope} from '../src/features/settings/aiCatalogCache';
import {aiServices, createAiSettingsPreview} from '../src/features/settings/aiSettingsModel';
import {reconcileCatalog} from '../src/features/settings/aiModelCatalog';

const service = aiServices.find(item => item.id === 'xai')!;
const connection = {...createAiSettingsPreview().connections.xai, key: 'test-only-never-persist'};
const signal = () => new AbortController().signal;

it('isolates accounts, endpoints, methods and modalities without including credential text in a key', () => {
  const key = catalogScope(service, connection, 'chat');
  expect(key).toMatch(/^[a-f0-9]{64}$/);
  for (const patch of [{key: 'another-key'}, {url: 'https://us.api.x.ai/v1'}, {routeId: 'oauth'}, {project: 'other-project'}, {protocol: 'responses'}]) {
    expect(catalogScope(service, {...connection, ...patch}, 'chat')).not.toBe(key);
  }
  expect(catalogScope(service, connection, 'image')).not.toBe(key);
  expect(catalogScope(service, {...connection, key: ` ${connection.key} `}, 'chat')).toBe(key);
});

it('persists safe metadata and restores it without confusing an empty live catalog with a missing cache', async () => {
  const values = new Map<string, string>();
  const repo = {getSetting: async (key: string) => values.get(key), setSetting: async (key: string, value: string) => {values.set(key, value);}};
  const cache = new AiCatalogCache(repo);
  const scope = catalogScope(service, connection, 'chat');
  const models = [{...service.models[0]!, source: 'api' as const, thinking: true, sampling: false, maxOutputTokens: 12000, secret: connection.key}];
  await cache.refresh(scope, async () => models, signal());
  await cache.flush();
  expect(values.get(aiCatalogCacheKey)).not.toContain(connection.key);
  expect(values.get(aiCatalogCacheKey)).not.toContain('secret');
  const restored = new AiCatalogCache(repo);
  await restored.load();
  expect(restored.get(scope)?.models[0]).toMatchObject({thinking: true, sampling: false, maxOutputTokens: 12000});
  await restored.refresh(scope, async () => [], signal());
  expect(restored.get(scope)?.models).toEqual([]);
});

it('deduplicates concurrent openings but still makes a fresh request on the next opening', async () => {
  const cache = new AiCatalogCache();
  let finish!: (value: typeof service.models) => void;
  const loader = vi.fn(() => new Promise<typeof service.models>(resolve => {finish = resolve;}));
  const first = cache.refresh('scope', loader, signal());
  const second = cache.refresh('scope', loader, signal());
  await Promise.resolve();
  expect(loader).toHaveBeenCalledTimes(1);
  finish(service.models);
  await Promise.all([first, second]);
  const next = vi.fn().mockResolvedValue(service.models);
  await cache.refresh('scope', next, signal());
  expect(next).toHaveBeenCalledOnce();
});

it('does not replace good cached data after a failure or a late cancelled response', async () => {
  const cache = new AiCatalogCache();
  await cache.refresh('scope', async () => service.models, signal());
  await expect(cache.refresh('scope', async () => {throw new Error('offline');}, signal())).rejects.toThrow();
  let finish!: (value: typeof service.models) => void;
  const controller = new AbortController();
  const pending = cache.refresh('scope', () => new Promise(resolve => {finish = resolve;}), controller.signal);
  await Promise.resolve();
  controller.abort();
  finish([]);
  await pending;
  expect(cache.get('scope')?.models.map(model => model.id)).toEqual(service.models.map(model => model.id));
});

it('keeps existing order and updates metadata while inserting new IDs only once', () => {
  const [a, b] = service.models;
  const c = {...a!, id: 'new', name: 'New'};
  expect(reconcileCatalog([a!, b!], [b!, c, {...a!, name: 'Updated'}, c]).map(model => model.name)).toEqual(['New', 'Updated', b!.name]);
  expect(reconcileCatalog([a!, b!], [])).toEqual([]);
  expect(reconcileCatalog([a!, b!], [b!])).toEqual([b]);
});
