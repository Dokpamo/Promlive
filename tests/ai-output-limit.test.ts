import {describe, expect, it} from 'vitest';
import {aiServices, chooseConnectionRoute, choosePreviewModel, connectionRoutes, createAiSettingsPreview, modelPresetFor, previewModel} from '../src/features/settings/aiSettingsModel';
import {outputLimitValue, resolveOutputLimit} from '../src/features/settings/aiOutputLimit';
import {restoreAiPreferences, serializeAiPreferences} from '../src/features/settings/aiSettingsPreferences';

describe('generation token limits', () => {
  it('defaults every provider and connection route to 10,000 or the smaller model ceiling', () => {
    const state = createAiSettingsPreview();
    for (const service of aiServices) {
      for (const route of connectionRoutes(service)) {
        const connection = chooseConnectionRoute(service, state.connections[service.id], route.id);
        const maximum = previewModel(service, connection.model, connection).maxOutputTokens;
        expect(modelPresetFor(service.id, connection).maxTokens).toBe(String(Math.min(10000, maximum || 10000)));
      }
    }
  });

  it('uses the API output ceiling, including when refreshed after a model was selected', () => {
    const model = {id: 'limited-model', name: 'Limited model', detail: '', effort: [], tools: [], source: 'api' as const, maxOutputTokens: 8192};
    const connection = choosePreviewModel('xai', createAiSettingsPreview().connections.xai, model);
    expect(modelPresetFor('xai', connection).maxTokens).toBe('8192');
    connection.catalogModel = {...model, maxOutputTokens: 4096};
    expect(modelPresetFor('xai', connection).maxTokens).toBe('4096');
    connection.modelPresets[model.id]!.maxTokens = '2000';
    expect(modelPresetFor('xai', connection).maxTokens).toBe('2000');
  });

  it('migrates old defaults on all saved routes once and keeps custom limits', () => {
    const state = createAiSettingsPreview();
    for (const service of aiServices) {
      const connection = state.connections[service.id];
      connection.modelPresets[connection.model]!.maxTokens = service.id === 'anthropic' ? '4096' : '';
      const nextRoute = connectionRoutes(service)[1];
      if (nextRoute) state.connections[service.id] = chooseConnectionRoute(service, connection, nextRoute.id);
    }
    const saved = JSON.parse(serializeAiPreferences(state));
    saved.version = 1;
    const xai = saved.connections.xai;
    xai.modelPresets[xai.model].maxTokens = '8192';
    const restored = restoreAiPreferences(JSON.stringify(saved));
    expect(restored.connections.xai.modelPresets[xai.model]?.maxTokens).toBe('8192');
    expect(restored.connections.xai.routes.api?.modelPresets[state.connections.xai.routes.api!.model]?.maxTokens).toBe('10000');
    const claude = restored.connections.anthropic;
    expect(claude.modelPresets[claude.model]?.maxTokens).toBe('10000');
    claude.modelPresets[claude.model]!.maxTokens = '4096';
    const reopened = restoreAiPreferences(serializeAiPreferences(restored));
    expect(reopened.connections.anthropic.modelPresets[claude.model]?.maxTokens).toBe('4096');
  });

  it.each(['', '   '])('uses 10,000 when a setting is cleared (%j)', value => {
    expect(resolveOutputLimit(value)).toBe(10000);
    expect(resolveOutputLimit(value, 4096)).toBe(4096);
  });

  it.each(['0', '-1', '1.5', 'NaN', 'Infinity', '1e4', '10,000', '9007199254740992'])('blocks an invalid value instead of sending an unlimited request (%s)', value => {
    expect(outputLimitValue(value)).toBe(value);
    expect(() => resolveOutputLimit(value)).toThrow('1 이상의 정수');
  });
});
