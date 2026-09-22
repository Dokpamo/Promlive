import {afterEach, describe, expect, it, vi} from 'vitest';
import {loadXaiCatalog, parseXaiCatalog, xaiCatalogUrl, type CatalogRequest} from '../src/adapters/ai/xaiCatalog';
import {AiCatalogError, type AiCatalogKind} from '../src/ports/aiCatalog';
import {loadAiModels} from '../src/features/settings/aiModelCatalog';
import {aiServices, createAiSettingsPreview} from '../src/features/settings/aiSettingsModel';

const connection = {url: 'https://api.x.ai/v1', key: 'test-only-key'};
const signal = () => new AbortController().signal;
afterEach(() => {vi.unstubAllGlobals(); vi.useRealTimers();});

describe('xAI live catalogs', () => {
  it.each([
    ['chat', 'language-models', {models: [{id: 'new-chat', input_modalities: ['text', 'image'], output_modalities: ['text']}]}],
    ['image', 'image-generation-models', {models: [{id: 'new-image', output_modalities: ['image']}]}],
    ['video', 'video-generation-models', {models: [{id: 'new-video', output_modalities: ['video']}]}],
    ['voice', 'tts/voices', {voices: [{voice_id: 'ara', name: 'Ara'}]}],
  ] as const)('fetches %s choices from the corresponding authenticated GET endpoint', async (kind, path, body) => {
    const request = vi.fn<CatalogRequest>().mockResolvedValue(new Response(JSON.stringify(body)));
    const entries = await loadXaiCatalog(connection, kind, signal(), request);
    expect(entries).toHaveLength(1);
    expect(request).toHaveBeenCalledWith(`https://api.x.ai/v1/${path}`, expect.objectContaining({
      method: 'GET', headers: {Authorization: 'Bearer test-only-key', Accept: 'application/json'}, credentials: 'omit', redirect: 'error', cache: 'no-store',
    }));
    expect(request.mock.calls[0]![1]).not.toHaveProperty('body');
  });

  it('does not send an empty key or forward credentials to another endpoint', async () => {
    const request = vi.fn<CatalogRequest>();
    await expect(loadXaiCatalog({...connection, key: '  '}, 'chat', signal(), request)).rejects.toMatchObject({code: 'key'});
    for (const url of ['http://api.x.ai/v1', 'https://example.com/v1', 'https://api.x.ai.example.com/v1', 'https://api.x.ai/v1?key=x', 'https://user@api.x.ai/v1', 'https://api.x.ai:444/v1', 'https://api.x.ai/v1/other']) {
      await expect(loadXaiCatalog({...connection, url}, 'chat', signal(), request)).rejects.toMatchObject({code: 'endpoint'});
    }
    expect(request).not.toHaveBeenCalled();
    expect(xaiCatalogUrl('https://us.api.x.ai/v1/', 'chat')).toBe('https://us.api.x.ai/v1/language-models');
  });

  it.each([[401, 'auth'], [403, 'permission'], [429, 'rate'], [503, 'response']] as const)('handles HTTP %s without showing the upstream response', async (status, code) => {
    const request = vi.fn<CatalogRequest>().mockResolvedValue(new Response('sensitive upstream response', {status}));
    const error = await loadXaiCatalog(connection, 'chat', signal(), request).catch(error => error);
    expect(error).toMatchObject({code});
    expect(error.message).not.toContain('sensitive');
  });

  it('rejects invalid responses, keeps an empty catalog empty, and removes duplicate IDs', () => {
    expect(() => parseXaiCatalog('chat', {data: [{id: 'not-the-language-model-contract'}]})).toThrow(AiCatalogError);
    expect(() => parseXaiCatalog('voice', {voices: [{id: 'invalid'}]})).toThrow(AiCatalogError);
    expect(parseXaiCatalog('image', {models: []})).toEqual([]);
    expect(parseXaiCatalog('chat', {models: [{id: 'same'}, {id: 'same'}]})).toHaveLength(1);
    expect(parseXaiCatalog('chat', {models: [{id: 'no-reasoning', capabilities: null, aliases: null}]})).toMatchObject([{id: 'no-reasoning', aliases: []}]);
  });

  it('cancels an in-flight lookup when the picker is closed', async () => {
    const controller = new AbortController();
    let requestSignal: AbortSignal | null | undefined;
    const request = vi.fn<CatalogRequest>().mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      requestSignal = init?.signal;
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const lookup = loadXaiCatalog(connection, 'video', controller.signal, request);
    controller.abort();
    await expect(lookup).rejects.toBeInstanceOf(AiCatalogError);
    expect(requestSignal?.aborted).toBe(true);
  });

  it('times out an unresponsive provider', async () => {
    vi.useFakeTimers();
    const request = vi.fn<CatalogRequest>().mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const lookup = loadXaiCatalog(connection, 'voice', signal(), request);
    const assertion = expect(lookup).rejects.toMatchObject({code: 'timeout'});
    await vi.advanceTimersByTimeAsync(15000);
    await assertion;
  });

  it('uses API reasoning metadata for a known model and retains unfamiliar model IDs', async () => {
    const service = aiServices.find(item => item.id === 'xai')!;
    const saved = {...createAiSettingsPreview().connections.xai, ...connection};
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({models: [
      {id: 'grok-4.6', capabilities: {reasoning_effort: ['none', 'high']}},
      {id: 'new-model-from-api', capabilities: {reasoning_effort: ['medium']}, input_modalities: ['text', 'image'], output_modalities: ['text']},
    ]}))));
    const models = await loadAiModels(service, saved, signal());
    expect(models).toHaveLength(2);
    expect(models[0]).toMatchObject({id: 'grok-4.6', effort: ['none', 'high'], source: 'api'});
    expect(models[1]).toMatchObject({id: 'new-model-from-api', effort: ['medium'], tools: [], source: 'api'});
    expect(models[1]?.detail).toContain('이미지');
  });

  it('never substitutes the fixture list after an API failure or on an unconnected OAuth route', async () => {
    const service = aiServices.find(item => item.id === 'xai')!;
    const saved = {...createAiSettingsPreview().connections.xai, ...connection};
    const request = vi.fn().mockRejectedValue(new Error('private transport detail'));
    vi.stubGlobal('fetch', request);
    for (const kind of ['chat', 'image', 'video', 'voice'] satisfies AiCatalogKind[]) {
      await expect(loadAiModels(service, saved, signal(), kind)).rejects.toMatchObject({code: 'network'});
    }
    const calls = request.mock.calls.length;
    await expect(loadAiModels(service, {...saved, routeId: 'oauth'}, signal())).rejects.toMatchObject({code: 'connection'});
    expect(request).toHaveBeenCalledTimes(calls);
  });
});
