import {expect, it, vi} from 'vitest';
import {createSettingsServices} from '../src/app/settingsServices';

vi.mock('../src/adapters/sqlite/open', async () => {
  const {nodeDatabase: open} = await import('./helpers');
  return {openDatabase: vi.fn(async () => open())};
});
vi.mock('../src/adapters/credentials/store', () => ({credentialStore: {
  get: async () => null, set: async () => {}, remove: async () => {},
}}));

it('boots real runtime services once and persists current settings in their shared SQLite store', async () => {
  const {initialize} = await import('../src/app/runtime');
  const {credentialStore} = await import('../src/adapters/credentials/store');
  const runtime = await initialize();
  try {
    expect(await initialize()).toBe(runtime);
    const settings = createSettingsServices(runtime.repo, credentialStore, {ai: runtime.aiPreferences!, extensions: runtime.extensions!});
    await settings.load();
    settings.general.update({theme: 'dark', prompt: '회귀 검증', language: '한국어'});
    await settings.general.flush();
    expect(await runtime.repo.getSetting('appearance:theme')).toBe('dark');
    expect(await runtime.repo.getSetting('ui:prompt:v1')).toBe('회귀 검증');
    expect(settings.ai).toBe(runtime.aiPreferences);
    expect(runtime.creation).toBeDefined();
  } finally {await runtime.database!.close();}
});
