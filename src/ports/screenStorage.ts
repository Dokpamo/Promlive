export interface ScreenStorage {
  /** A bounded local read before the first React render; never fetch the network. */
  readSync(): string | null;
  readBackupSync(): string | null;
  read(): Promise<string | null>;
  /** Compare and replace under the storage's cross-instance lock/transaction. */
  write(value: string, expected: string | null): Promise<void>;
  /** Presentation is separate (per-tab session storage on web) and never writes content. */
  readViewSync(): string | null;
  writeView(value: string): Promise<void>;
}
/** The adapter only needs validity, never route/card/message schema details. */
export type ScreenContentInspector = (raw: string | null) => {kind: 'valid' | 'empty' | 'corrupt' | 'unsupported'};
export const screenStorageKey = 'promlive:screen:local:v1';
export const screenViewKey = screenStorageKey + ':view';
export class ScreenStorageConflict extends Error {
  constructor() {super('Screen content changed in another instance');}
}
