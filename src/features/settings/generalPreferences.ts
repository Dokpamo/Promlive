import type {SettingsStore} from '../../ports/settings';

export type ThemeMode = 'light' | 'dark' | 'system';
export const themeLabels = {light: '라이트 모드', dark: '다크 모드', system: '기기 설정 사용'};
type Preferences = {theme: ThemeMode; prompt: string; language: string};
const defaults: Preferences = {theme: 'light', prompt: '', language: '한국어'};
const keys = {theme: 'appearance:theme', prompt: 'ui:prompt:v1', language: 'ui:language:v1'} as const;
type PreferenceKey = keyof Preferences;
const fields = Object.keys(keys) as PreferenceKey[];

export class GeneralPreferences {
  private state = {...defaults, ready: false, error: ''};
  private saved: Preferences = {...defaults};
  private edited = new Set<PreferenceKey>();
  private listeners = new Set<() => void>();
  private saving = Promise.resolve();
  private loading: Promise<void> | undefined;
  constructor(private readonly repo: SettingsStore) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  private emit() {this.listeners.forEach(listener => listener());}
  load() {
    return this.loading ??= (async () => {
      const [theme, prompt, language] = await Promise.all(fields.map(key => this.repo.getSetting(keys[key])));
      this.saved = {theme: theme === 'dark' || theme === 'system' ? theme : 'light', prompt: prompt ?? '', language: language ?? '한국어'};
      const edits = Object.fromEntries([...this.edited].map(key => [key, this.state[key]]));
      this.state = {...this.saved, ...edits, ready: true, error: ''};
      this.edited.clear();
      this.emit();
    })().catch(error => {this.loading = undefined; throw error;});
  }
  update = (patch: Partial<Preferences>) => {
    const changed = fields.filter(key => patch[key] !== undefined && patch[key] !== this.state[key]);
    if (!changed.length && !this.state.error) return;
    if (!this.state.ready) changed.forEach(key => this.edited.add(key));
    this.state = {...this.state, ...patch};
    this.emit();
    // Capture each requested edit, but compare with successful writes when its turn
    // arrives. A failed write stays dirty; update({}) retries it without rewriting
    // unrelated settings or dropping edits queued during the failed operation.
    const value = {...this.state};
    const requested = value.ready ? fields : [...this.edited];
    this.saving = this.saving.then(async () => {
      await this.load();
      const dirty = requested.filter(key => value[key] !== this.saved[key]);
      if (dirty.length > 1 && this.repo.setSettings) {
        await this.repo.setSettings(dirty.map(key => ({key: keys[key], value: value[key]})));
        this.saved = {...this.saved, ...Object.fromEntries(dirty.map(key => [key, value[key]]))};
      } else {
        for (const key of dirty) {
          await this.repo.setSetting(keys[key], value[key]);
          this.saved = {...this.saved, [key]: value[key]};
        }
      }
      if (this.state.error) {this.state = {...this.state, error: ''}; this.emit();}
    }).catch(() => {this.state = {...this.state, error: '설정을 저장하지 못했어요. 다시 시도해 주세요.'}; this.emit();});
  };
  flush() {return this.saving;}
}
