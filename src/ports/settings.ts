export interface SettingsStore {
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
  /** Optional atomic batch for stores that otherwise persist after each write. */
  setSettings?(entries: readonly {key: string; value: string}[]): Promise<void>;
}
