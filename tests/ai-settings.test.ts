import {describe, expect, it} from 'vitest';
import {aiServices, chooseConnectionRoute, choosePreviewModel, connectionModels, connectionRoute, connectionRoutes, createAiSettingsPreview, modelPresetCapabilities, modelPresetFor, previewModel} from '../src/features/settings/aiSettingsModel';

describe('AI preset separation', () => {
  it.each([
    ['xai', 'grok-4.6', 'high'], ['anthropic', 'claude-opus-4-6', 'high'],
    ['openai', 'gpt-5.4', 'none'], ['openai', 'gpt-5.6-sol', 'medium'],
    ['google', 'gemini-3.8-flash', 'medium'], ['google', 'gemini-3.1-pro-preview', 'high'],
    ['deepseek', 'deepseek-v4-pro', 'high'], ['qwen', 'qwen3.8-max', 'xhigh'],
    ['zai', 'glm-5.3', 'max'], ['kimi', 'kimi-k3', 'max'],
  ] as const)('selects the actual default for %s / %s', (id, model, effort) => {
    const service = aiServices.find(item => item.id === id)!;
    const selected = choosePreviewModel(id, createAiSettingsPreview().connections[id], previewModel(service, model));
    expect(selected.modelPresets[model]?.effort).toBe(effort);
    expect(modelPresetFor(id, selected).effort).toBe(effort);
  });

  it('resolves legacy defaults and old cached metadata without overwriting an explicit choice', () => {
    const service = aiServices.find(item => item.id === 'xai')!;
    const connection = createAiSettingsPreview().connections.xai;
    const {defaultEffort: _, ...legacy} = previewModel(service, connection.model);
    connection.catalogModel = {...legacy, source: 'api'};
    expect(modelPresetFor('xai', connection).effort).toBe('high');
    connection.modelPresets[connection.model]!.effort = 'low';
    expect(modelPresetFor('xai', connection).effort).toBe('low');
    expect(choosePreviewModel('xai', connection, legacy).modelPresets[connection.model]?.effort).toBe('low');
  });

  it('uses a valid API default and leaves unknown or incompatible defaults unselected', () => {
    const connection = createAiSettingsPreview().connections.xai;
    const fresh = {id: 'api-new', name: 'API new', detail: '', source: 'api' as const, effort: ['low', 'high'], tools: []};
    const choose = (defaultEffort?: string) => modelPresetFor('xai', choosePreviewModel('xai', connection, {...fresh, ...(defaultEffort ? {defaultEffort} : {})}));
    expect(choose('low').effort).toBe('low');
    expect(choose().effort).toBe('default');
    expect(choose('unsupported').effort).toBe('default');
    const service = aiServices.find(item => item.id === 'xai')!;
    const changed = {...previewModel(service, connection.model), source: 'api' as const, defaultEffort: 'low'};
    expect(modelPresetFor('xai', choosePreviewModel('xai', connection, changed)).effort).toBe('low');
  });

  it('restores each model preset without moving app instructions or connection credentials into it', () => {
    const state = createAiSettingsPreview();
    const service = aiServices.find(item => item.id === 'xai')!;
    state.appPreset.length = 'short';
    const first = state.connections.xai;
    first.key = 'test-only-placeholder';
    first.modelPresets[first.model] = {...modelPresetFor('xai', first), effort: 'high', maxTokens: '8192', tools: ['x']};

    const second = choosePreviewModel('xai', first, previewModel(service, 'grok-4.5'));
    expect(modelPresetFor('xai', second)).toMatchObject({effort: 'high', maxTokens: '', tools: []});
    const restored = choosePreviewModel('xai', second, previewModel(service, first.model));
    expect(modelPresetFor('xai', restored)).toMatchObject({effort: 'high', maxTokens: '8192', tools: ['x']});
    expect(restored.key).toBe(first.key);
    expect(state.appPreset.length).toBe('short');
    for (const preset of Object.values(restored.modelPresets)) {
      for (const field of ['length', 'key', 'url']) expect(preset).not.toHaveProperty(field);
    }
  });

  it('does not guess model capabilities when the user enters an unknown model ID', () => {
    const state = createAiSettingsPreview();
    const service = aiServices.find(item => item.id === 'openai')!;
    const unknown = choosePreviewModel(service.id, state.connections.openai, previewModel(service, 'my-custom-model'));
    expect(modelPresetCapabilities(service, unknown)).toMatchObject({reasoning: false, output: false, tools: false, advanced: false});
  });

  it('offers only the options that apply to the active thinking mode', () => {
    const state = createAiSettingsPreview();
    const deepseek = aiServices.find(item => item.id === 'deepseek')!;
    const connection = state.connections.deepseek;
    expect(modelPresetCapabilities(deepseek, connection)).toMatchObject({sampling: false, reasoningTopP: true});
    connection.modelPresets[connection.model] = {...modelPresetFor('deepseek', connection), thinking: 'disabled'};
    expect(modelPresetCapabilities(deepseek, connection)).toMatchObject({efforts: [], sampling: true, reasoningTopP: false});

    const anthropic = aiServices.find(item => item.id === 'anthropic')!;
    const claude = choosePreviewModel('anthropic', state.connections.anthropic, previewModel(anthropic, 'claude-opus-5'));
    claude.modelPresets[claude.model] = {...modelPresetFor('anthropic', claude), thinking: 'disabled'};
    expect(modelPresetCapabilities(anthropic, claude).efforts).toEqual(['low', 'medium', 'high']);
    expect(modelPresetFor('anthropic', claude).maxTokens).not.toBe('');
  });
});

describe('provider connection previews', () => {
  it('offers all requested providers with a valid API connection and model examples', () => {
    const state = createAiSettingsPreview();
    const requested = ['openai', 'xai', 'openrouter', 'anthropic', 'google', 'minimax', 'xiaomi', 'deepseek', 'qwen', 'zai', 'kimi'] as const;
    for (const id of requested) {
      const service = aiServices.find(item => item.id === id)!;
      const connection = state.connections[id];
      expect(connectionRoute(service, connection).auth).toBe('apiKey');
      expect(new URL(connection.url).protocol).toBe('https:');
      expect(connectionModels(service, connection).some(model => model.id === connection.model)).toBe(true);
    }
    expect(connectionRoutes(aiServices.find(item => item.id === 'anthropic')!).map(route => route.auth)).toEqual(['apiKey']);
  });

  it('keeps keys, endpoints and model presets separate between API regions', () => {
    const service = aiServices.find(item => item.id === 'minimax')!;
    const api = createAiSettingsPreview().connections.minimax;
    api.key = 'global-preview-key';
    api.modelPresets[api.model] = {...modelPresetFor('minimax', api), maxTokens: '8192'};

    const china = chooseConnectionRoute(service, api, 'api-cn');
    expect(china).toMatchObject({key: '', url: 'https://api.minimaxi.com/v1'});
    expect(modelPresetFor('minimax', china).maxTokens).toBe('');
    china.key = 'china-preview-key';

    const restored = chooseConnectionRoute(service, china, 'api');
    expect(restored).toMatchObject({key: 'global-preview-key', url: api.url, model: api.model});
    expect(modelPresetFor('minimax', restored).maxTokens).toBe('8192');
    expect(chooseConnectionRoute(service, restored, 'api-cn').key).toBe('china-preview-key');
    expect(chooseConnectionRoute(service, restored, 'invalid-route')).toBe(restored);
  });

  it('does not copy API model capabilities into an account-only catalog', () => {
    const state = createAiSettingsPreview();
    for (const id of ['openai', 'google', 'xai'] as const) {
      const service = aiServices.find(item => item.id === id)!;
      const oauthRoute = connectionRoutes(service).find(route => route.auth === 'oauth')!;
      const oauth = chooseConnectionRoute(service, state.connections[id], oauthRoute.id);
      const manuallyEntered = {...oauth, model: service.models[0]!.id};
      expect(modelPresetCapabilities(service, manuallyEntered)).toMatchObject({reasoning: false, output: false, tools: false, advanced: false});
    }
  });

  it('preserves separate local and cloud Ollama settings', () => {
    const service = aiServices.find(item => item.id === 'ollama')!;
    const local = createAiSettingsPreview().connections.ollama;
    local.url = 'http://192.168.1.2:11434';
    local.model = 'my-local-model';
    const cloud = chooseConnectionRoute(service, local, 'cloud');
    expect(cloud).toMatchObject({ollamaMode: 'cloud', url: 'https://ollama.com', model: ''});
    expect(modelPresetCapabilities(service, cloud).localRuntime).toBe(false);
    const restored = chooseConnectionRoute(service, cloud, 'local');
    expect(restored.url).toBe(local.url);
    expect(restored.model).toBe('my-local-model');
    expect(modelPresetCapabilities(service, restored).localRuntime).toBe(true);
  });

  it('gates provider-specific controls instead of assuming every model has the same thinking mode', () => {
    const state = createAiSettingsPreview();
    const mimo = aiServices.find(item => item.id === 'xiaomi')!;
    const connection = state.connections.xiaomi;
    expect(modelPresetCapabilities(mimo, connection).sampling).toBe(false);
    connection.modelPresets[connection.model] = {...modelPresetFor('xiaomi', connection), thinking: 'disabled'};
    expect(modelPresetCapabilities(mimo, connection)).toMatchObject({sampling: true, stop: false});

    const glm = aiServices.find(item => item.id === 'zai')!;
    const glmConnection = state.connections.zai;
    expect(modelPresetCapabilities(glm, glmConnection).efforts).toEqual(['low', 'high', 'max']);
    expect(previewModel(glm, 'glm-5.3').thinking).toBeUndefined(); // Forced thinking: no off switch.
    glmConnection.modelPresets[glmConnection.model] = {...modelPresetFor('zai', glmConnection), thinking: 'disabled'};
    expect(modelPresetCapabilities(glm, glmConnection).efforts).toEqual(['low', 'high', 'max']);

    const minimax = aiServices.find(item => item.id === 'minimax')!;
    expect(previewModel(minimax, 'MiniMax-M3').adaptiveThinking).toBe(true);
    expect(previewModel(minimax, 'MiniMax-M2.7').thinking).toBeUndefined();
    const kimi = aiServices.find(item => item.id === 'kimi')!;
    expect(previewModel(kimi, 'kimi-k3').thinking).toBeUndefined();
    expect(modelPresetCapabilities(kimi, state.connections.kimi).efforts).toEqual(['low', 'high', 'max']);
  });
});
