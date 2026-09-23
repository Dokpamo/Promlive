import {describe, expect, it, vi} from 'vitest';
import {loadProviderCatalog, parseProviderCatalog, providerCatalogUrl} from '../src/adapters/ai/providerCatalog';
import type {CatalogRequest} from '../src/adapters/ai/catalogRequest';

const signal = () => new AbortController().signal;
const response = (body: unknown) => new Response(JSON.stringify(body));
describe('provider catalog contracts', () => {
  it('reads the router effort/default contract instead of guessing the original provider settings', () => {
    const {entries} = parseProviderCatalog('openrouter', {data: [
      {id: 'vendor/levels', reasoning: {supported_efforts: ['high', 'medium', 'low'], default_effort: 'medium', mandatory: true}},
      {id: 'vendor/unrestricted', reasoning: {supported_efforts: null, default_effort: 'none'}},
      {id: 'vendor/always-on', reasoning: {supported_efforts: ['none', 'low', 'high'], default_effort: 'high', mandatory: true}},
      {id: 'vendor/budget-only', reasoning: {supports_max_tokens: true}},
      {id: 'vendor/no-reasoning'},
      {id: 'vendor/off-by-default', reasoning: {supported_efforts: ['none', 'low', 'high'], default_effort: 'high', default_enabled: false}},
    ]}, 'chat');
    expect(entries[0]).toMatchObject({reasoningEfforts: ['high', 'medium', 'low'], defaultReasoningEffort: 'medium'});
    expect(entries[1]?.reasoningEfforts).toContain('none');
    expect(entries[2]?.reasoningEfforts).toEqual(['low', 'high']);
    expect(entries[3]?.reasoningEfforts).toEqual([]);
    expect(entries[4]?.reasoningEfforts).toEqual([]);
    expect(entries[5]?.defaultReasoningEffort).toBe('none');
  });
  it.each([
    ['openai', 'https://api.openai.com/v1', 'https://api.openai.com/v1/models'],
    ['anthropic', 'https://api.anthropic.com', 'https://api.anthropic.com/v1/models'],
    ['google', 'https://generativelanguage.googleapis.com', 'https://generativelanguage.googleapis.com/v1beta/models'],
    ['openrouter', 'https://openrouter.ai/api/v1', 'https://openrouter.ai/api/v1/models'],
    ['deepseek', 'https://api.deepseek.com', 'https://api.deepseek.com/v1/models'],
    ['minimax', 'https://api.minimax.io/v1', 'https://api.minimax.io/v1/models'],
    ['xiaomi', 'https://api.xiaomimimo.com/v1', 'https://api.xiaomimimo.com/v1/models'],
    ['kimi', 'https://api.moonshot.cn/v1', 'https://api.moonshot.cn/v1/models'],
    ['qwen', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', 'https://dashscope-intl.aliyuncs.com/api/v1/models'],
    ['ollama', 'http://localhost:11434', 'http://localhost:11434/api/tags'],
    ['custom', 'https://my-server.example/v1/', 'https://my-server.example/v1/models'],
  ])('uses the %s discovery endpoint', (provider, url, expected) => expect(providerCatalogUrl(provider, url)).toBe(expected));

  it('only sends cloud keys to the chosen official provider and prevents credentialed redirects', async () => {
    const request = vi.fn<CatalogRequest>();
    for (const url of ['http://api.openai.com/v1', 'https://api.openai.com.evil.test/v1', 'https://user@api.openai.com/v1', 'https://example.com/v1', 'https://api.openai.com/v1?key=secret']) {
      await expect(loadProviderCatalog('openai', {url, key: 'test-key'}, 'chat', signal(), request)).rejects.toMatchObject({code: 'endpoint'});
    }
    await expect(loadProviderCatalog('openai', {url: 'https://api.openai.com/v1', key: ''}, 'chat', signal(), request)).rejects.toMatchObject({code: 'key'});
    expect(request).not.toHaveBeenCalled();
  });

  it('reads OpenRouter publicly and separates output modalities from input modalities', async () => {
    const request = vi.fn<CatalogRequest>().mockResolvedValue(response({data: [
      {id: 'chat', architecture: {input_modalities: ['text', 'image'], output_modalities: ['text']}, supported_parameters: ['max_tokens', 'temperature']},
      {id: 'paint', architecture: {output_modalities: ['text', 'image']}},
      {id: 'voice', architecture: {output_modalities: ['audio']}},
    ]}));
    const result = await loadProviderCatalog('openrouter', {url: 'https://openrouter.ai/api/v1', key: ''}, 'chat', signal(), request);
    expect(result.map(model => model.id)).toEqual(['chat']);
    expect(result[0]?.parameters).toEqual(['max_tokens', 'temperature']);
    expect(request.mock.calls[0]?.[1]).toMatchObject({method: 'GET', redirect: 'error', credentials: 'omit', headers: {Accept: 'application/json'}});
    expect(request.mock.calls[0]?.[1].headers).not.toHaveProperty('Authorization');
    expect(request.mock.calls[0]?.[0]).toBe('https://openrouter.ai/api/v1/models?output_modalities=all');
  });

  it('walks Anthropic pages and keeps API-reported capabilities authoritative', async () => {
    const request = vi.fn<CatalogRequest>().mockResolvedValueOnce(response({data: [{id: 'claude-new', capabilities: {effort: {supported: true, low: {supported: true}, high: {supported: false}}, thinking: {supported: true, types: {adaptive: {supported: true}}}, code_execution: {supported: true}}, max_tokens: 64000}], has_more: true, last_id: 'claude-new'})).mockResolvedValueOnce(response({data: [{id: 'claude-old'}], has_more: false}));
    const result = await loadProviderCatalog('anthropic', {url: 'https://api.anthropic.com', key: 'test-key'}, 'chat', signal(), request);
    expect(result[0]).toMatchObject({reasoningEfforts: ['low'], thinking: true, adaptiveThinking: true, tools: ['code'], maxOutputTokens: 64000});
    expect(result).toHaveLength(2);
    expect(request.mock.calls[1]?.[0]).toContain('after_id=claude-new');
    expect(request.mock.calls[0]?.[1].headers).toMatchObject({'x-api-key': 'test-key', 'anthropic-version': '2023-06-01'});
  });

  it('walks Gemini pages, excludes embeddings and preserves the actual model ID', async () => {
    const request = vi.fn<CatalogRequest>().mockResolvedValueOnce(response({models: [{name: 'models/gemini-new', supportedGenerationMethods: ['generateContent'], outputTokenLimit: 8192}, {name: 'models/embedding-1', supportedGenerationMethods: ['embedContent']}], nextPageToken: 'next&token'})).mockResolvedValueOnce(response({models: [{name: 'models/gemini-old', supportedGenerationMethods: ['generateContent']}]}));
    const result = await loadProviderCatalog('google', {url: 'https://generativelanguage.googleapis.com', key: 'test-key'}, 'chat', signal(), request);
    expect(result.map(model => model.id)).toEqual(['gemini-new', 'gemini-old']);
    expect(request.mock.calls[1]?.[0]).toContain('pageToken=next%26token');
    expect(request.mock.calls[0]?.[0]).not.toContain('test-key');
    expect(request.mock.calls[0]?.[1].headers).toMatchObject({'x-goog-api-key': 'test-key'});
  });

  it('reads Qwen metadata and stops repeated page cursors instead of publishing a partial list', async () => {
    const body = {success: true, output: {total: 2, page_no: 1, page_size: 1, models: [{model: 'qwen-test', features: ['web-search'], inference_metadata: {response_modality: ['Text'], request_modality: ['Text', 'Image']}, model_info: {context_window: 128000, max_output_tokens: 8192}}]}};
    expect(parseProviderCatalog('qwen', body, 'chat')).toMatchObject({entries: [{id: 'qwen-test', inputModalities: ['text', 'image'], tools: ['web'], maxOutputTokens: 8192}], next: '2'});
    const request = vi.fn<CatalogRequest>().mockImplementation(async () => response(body));
    await expect(loadProviderCatalog('qwen', {url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', key: 'test-key', project: 'workspace123'}, 'chat', signal(), request)).rejects.toMatchObject({code: 'response'});
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]?.[0]).toContain('https://workspace123.cn-beijing.maas.aliyuncs.com/api/v1/models');
  });

  it('requires a valid Qwen workspace before a China catalog lookup can send credentials', async () => {
    const request = vi.fn<CatalogRequest>();
    for (const project of ['', 'other.example/path', 'workspace@evil.test']) {
      await expect(loadProviderCatalog('qwen', {url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', key: 'test-key', project}, 'chat', signal(), request)).rejects.toMatchObject({code: 'workspace'});
    }
    expect(request).not.toHaveBeenCalled();
  });

  it('preserves an empty local model list and rejects malformed catalogs', () => {
    expect(parseProviderCatalog('ollama', {models: []}, 'chat').entries).toEqual([]);
    expect(parseProviderCatalog('ollama', {models: [{name: 'local-model'}]}, 'chat').entries[0]?.id).toBe('local-model');
    expect(() => parseProviderCatalog('openai', {error: {message: 'secret'}}, 'chat')).toThrow();
  });

  it('separates current live, music, speech and video model IDs from text-only models', () => {
    const body = {models: ['gemini-3.8-flash', 'gemini-3.8-live', 'lyria-3.5', 'gemini-omni-1.1-flash'].map(id => ({name: `models/${id}`, supportedGenerationMethods: ['generateContent']}))};
    expect(parseProviderCatalog('google', body, 'chat').entries.map(row => row.id)).toEqual(['gemini-3.8-flash']);
    expect(parseProviderCatalog('google', body, 'audio').entries.map(row => row.id)).toEqual(['gemini-3.8-live', 'lyria-3.5']);
    expect(parseProviderCatalog('google', body, 'video').entries.map(row => row.id)).toEqual(['gemini-omni-1.1-flash']);
    const audio = {data: ['speech', 'transcription'].map(modality => ({id: modality, architecture: {output_modalities: [modality]}}))};
    expect(parseProviderCatalog('openrouter', audio, 'audio').entries).toHaveLength(2);
  });

  it('retains documented MiniMax media instead of treating the text-only discovery API as an empty catalog', async () => {
    const request = vi.fn<CatalogRequest>().mockResolvedValue(response({data: [{id: 'MiniMax-M3'}]}));
    await expect(loadProviderCatalog('minimax', {url: 'https://api.minimax.io/v1', key: 'test'}, 'image', signal(), request)).rejects.toMatchObject({code: 'unavailable'});
    expect(request).toHaveBeenCalledTimes(1);
    request.mockResolvedValue(response({data: [{id: 'image-01'}]}));
    expect(await loadProviderCatalog('minimax', {url: 'https://api.minimax.io/v1', key: 'test'}, 'image', signal(), request)).toMatchObject([{id: 'image-01'}]);
  });
});
