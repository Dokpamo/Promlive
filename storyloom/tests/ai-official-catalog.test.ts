import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {officialCatalog, officialCatalogKinds, officialModels} from '../src/features/settings/aiOfficialCatalog';
import {aiModelSchema} from '../src/features/settings/aiModelSchema';
import {aiServices, connectionRoutes, createAiSettingsPreview} from '../src/features/settings/aiSettingsModel';
import {catalogKinds, defaultCatalog} from '../src/features/settings/aiModelCatalog';

const auditedOn = '2026-09-21';
describe('documented model catalogs', () => {
  it('validates every bundled row and records sources for every official provider', () => {
    const schema = aiModelSchema.extend({kind: z.enum(['chat', 'image', 'video', 'audio', 'voice']), retiresOn: z.iso.date().optional()});
    expect(Object.keys(officialCatalog.providers).sort()).toEqual(aiServices.map(service => service.id).sort());
    expect(officialCatalog.checkedAt).toBe(auditedOn);
    for (const service of aiServices) {
      const provider = officialCatalog.providers[service.id];
      if (service.id !== 'custom') expect(provider.sources.length).toBeGreaterThan(0);
      for (const source of provider.sources) expect(new URL(source).protocol).toBe('https:');
      for (const row of provider.models) {
        expect(schema.safeParse(row).success, `${service.id}: ${row.id}`).toBe(true);
        expect(row.source).toBeUndefined(); // Documentation is never mislabeled as a live account result.
      }
      expect(new Set(provider.models.map(row => `${row.kind}:${row.id}`)).size).toBe(provider.models.length);
    }
  });

  it.each([
    ['openai', 'chat', 'gpt-5.4-mini'], ['anthropic', 'chat', 'claude-haiku-4-5-20251001'],
    ['google', 'audio', 'lyria-3.5'], ['xai', 'chat', 'grok-4.20-0309-non-reasoning'],
    ['deepseek', 'chat', 'deepseek-v4-pro'], ['minimax', 'video', 'MiniMax-Hailuo-2.3-Fast'],
    ['xiaomi', 'audio', 'mimo-v2.5-asr'], ['qwen', 'image', 'wan2.7-image-pro'],
    ['zai', 'video', 'cogvideox-3'], ['kimi', 'chat', 'kimi-k2.7-code-highspeed'],
  ] as const)('includes documented %s %s models beyond the old sample list', (provider, kind, id) => {
    expect(officialModels(provider, kind, auditedOn).some(row => row.id === id)).toBe(true);
  });

  it('shows the full Grok catalog without a key, including media and distinct voices', () => {
    const service = aiServices.find(row => row.id === 'xai')!;
    const connection = createAiSettingsPreview().connections.xai;
    expect(connection.key).toBe('');
    expect(defaultCatalog(service, connection, 'chat')).toHaveLength(7);
    expect(defaultCatalog(service, connection, 'audio').map(row => row.id)).toEqual(['grok-voice-think-fast-2.0']);
    expect(defaultCatalog(service, connection, 'voice')).toHaveLength(5);
    expect(catalogKinds(service, connection)).toEqual(['chat', 'image', 'video', 'audio', 'voice']);
    expect(service.models.find(row => row.id === 'grok-4.5')?.effort).toEqual(['low', 'medium', 'high']);
    expect(service.models.find(row => row.id === 'grok-4.6')?.effort).toContain('xhigh');
  });

  it('bundles the public OpenRouter catalog and preserves dedicated audio/video categories', () => {
    expect(officialModels('openrouter', 'chat', auditedOn).length).toBeGreaterThan(400);
    for (const kind of ['image', 'video', 'audio'] as const) expect(officialModels('openrouter', kind, auditedOn).length).toBeGreaterThan(20);
    expect(officialCatalogKinds('zai')).toEqual(['chat', 'image', 'video', 'audio']);
  });

  it('removes retired entries and expires scheduled retirements without deleting saved preferences', () => {
    expect(officialModels('openai', 'chat', auditedOn).some(row => row.id === 'gpt-5.2-chat-latest')).toBe(false);
    expect(officialModels('anthropic', 'chat', auditedOn).some(row => row.id === 'claude-opus-4-1-20250805')).toBe(false);
    expect(officialModels('kimi', 'chat', auditedOn).some(row => row.id === 'kimi-k2.5')).toBe(false);
    expect(officialModels('openai', 'video', auditedOn)).toHaveLength(2);
    expect(officialModels('openai', 'video', '2026-09-24')).toHaveLength(0);
    expect(officialModels('xai', 'image', '2026-11-02').some(row => row.id === 'grok-imagine-image-quality')).toBe(false);
  });

  it('does not invent installed models or undocumented consumer account logins', () => {
    for (const id of ['ollama', 'custom'] as const) expect(officialModels(id, 'chat')).toEqual([]);
    for (const id of ['xai', 'minimax', 'qwen']) expect(connectionRoutes(aiServices.find(service => service.id === id)!).some(route => route.auth === 'oauth')).toBe(false);
  });
});
