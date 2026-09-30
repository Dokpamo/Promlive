export interface ScreenStorage {
  /** A bounded local read before the first React render; never fetch the network. */
  readSync(): string | null;
  readBackupSync(): string | null;
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
}
export const screenStorageKey = 'promlive:screen:local:v1';
