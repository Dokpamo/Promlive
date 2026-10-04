import {AiSettingsPreferences} from '../features/settings/aiSettingsPreferences';
import {AiCatalogCache} from '../features/settings/aiCatalogCache';
import {PersonaPreferences} from '../features/personas/personaPreferences';
import {UserProfilePreferences} from '../features/profile/userProfile';
import type {SettingsStore} from '../ports/settings';
import type {CredentialStore} from '../ports/ai';
import type {SummaryExtensions} from '../extensions/SummaryExtensions';
import {GeneralPreferences} from '../features/settings/generalPreferences';

/** Only data services cross the new UI boundary; legacy screens stay disconnected. */
export function createSettingsServices(repo: SettingsStore, credentials: CredentialStore, extras: {ai?: AiSettingsPreferences; extensions?: SummaryExtensions} = {}) {
  const ai = extras.ai ?? new AiSettingsPreferences(repo, credentials);
  const personas = new PersonaPreferences(repo);
  const profile = new UserProfilePreferences(repo);
  const catalogs = new AiCatalogCache(repo);
  const general = new GeneralPreferences(repo);
  return {ai, personas, profile, catalogs, general, extensions: extras.extensions,
    async load() {await Promise.all([ai.load(), personas.load(), profile.load(), catalogs.load(), general.load()]);}};
}
export type SettingsServices = ReturnType<typeof createSettingsServices>;
let pending: Promise<SettingsServices> | undefined;
export async function loadSettingsServices() {
  return pending ??= (async () => {
    const {initialize} = await import('./runtime');
    const runtime = await initialize();
    const {credentialStore} = await import('../adapters/credentials/store');
    const services = createSettingsServices(runtime.repo, credentialStore, {...(runtime.aiPreferences ? {ai: runtime.aiPreferences} : {}), ...(runtime.extensions ? {extensions: runtime.extensions} : {})});
    await services.load(); return services;
  })().catch(error => {pending = undefined; throw error;});
}
