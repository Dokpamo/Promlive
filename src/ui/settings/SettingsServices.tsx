import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import {AiSettingsPreferences} from '../../features/settings/aiSettingsPreferences';
import {AiCatalogCache} from '../../features/settings/aiCatalogCache';
import {PersonaPreferences} from '../../features/personas/personaPreferences';
import {UserProfilePreferences} from '../../features/profile/userProfile';
import type {SettingsStore} from '../../ports/settings';
import type {CredentialStore} from '../../ports/ai';
import type {SummaryExtensions} from '../../extensions/SummaryExtensions';

export type ThemeMode = 'light' | 'dark' | 'system';
export const themeLabels = {light: '라이트 모드', dark: '다크 모드', system: '기기 설정 사용'};
export class GeneralPreferences {
  private state = {theme: 'light' as ThemeMode, prompt: '', language: '한국어', ready: false, error: ''};
  private listeners = new Set<() => void>();
  private saving = Promise.resolve();
  private loading: Promise<void> | undefined;
  constructor(private readonly repo: SettingsStore) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  private emit() {this.listeners.forEach(listener => listener());}
  load() {
    return this.loading ??= (async () => {
    const [theme, prompt, language] = await Promise.all(['appearance:theme', 'ui:prompt:v1', 'ui:language:v1'].map(key => this.repo.getSetting(key)));
    this.state = {theme: theme === 'dark' || theme === 'system' ? theme : 'light', prompt: prompt ?? '', language: language ?? '한국어', ready: true, error: ''};
    this.emit();
    })().catch(error => {this.loading = undefined; throw error;});
  }
  update = (patch: Partial<Pick<ReturnType<GeneralPreferences['snapshot']>, 'theme' | 'prompt' | 'language'>>) => {
    this.state = {...this.state, ...patch}; this.emit();
    const value = this.state;
    this.saving = this.saving.then(async () => {
      await this.repo.setSetting('appearance:theme', value.theme);
      await this.repo.setSetting('ui:prompt:v1', value.prompt);
      await this.repo.setSetting('ui:language:v1', value.language);
      this.state = {...this.state, error: ''}; this.emit();
    }).catch(() => {this.state = {...this.state, error: '설정을 저장하지 못했어요. 다시 시도해 주세요.'}; this.emit();});
  };
  flush() {return this.saving;}
}

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
async function loadServices() {
  return pending ??= (async () => {
    const {initialize} = await import('../../app/runtime');
    const runtime = await initialize();
    const {credentialStore} = await import('../../adapters/credentials/store');
    const services = createSettingsServices(runtime.repo, credentialStore, {...(runtime.aiPreferences ? {ai: runtime.aiPreferences} : {}), ...(runtime.extensions ? {extensions: runtime.extensions} : {})});
    await services.load(); return services;
  })().catch(error => {pending = undefined; throw error;});
}
const Context = createContext<{services: SettingsServices | null; error: string; retry: () => void}>({services: null, error: '', retry: () => {}});
export function SettingsServicesProvider({children, services: provided}: {children: ReactNode; services?: SettingsServices | undefined}) {
  const [services, setServices] = useState<SettingsServices | null>(provided ?? null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    void (provided ? provided.load().then(() => provided) : loadServices()).then(value => {
      if (current) {setServices(value); setError('');}
    }).catch(() => {if (current) setError('설정 저장소를 열지 못했어요. 다시 시도해 주세요.');});
    return () => {current = false;};
  }, [provided, attempt]);
  return <Context.Provider value={{services, error, retry: () => setAttempt(value => value + 1)}}>{children}</Context.Provider>;
}
export const useSettingsServices = () => useContext(Context);
