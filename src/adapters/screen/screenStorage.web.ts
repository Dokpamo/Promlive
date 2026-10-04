import {screenStorageKey, screenViewKey, ScreenStorageConflict, type ScreenStorage, type ScreenContentInspector} from '../../ports/screenStorage';

export function createScreenStorage(inspect: ScreenContentInspector): ScreenStorage {
  return {
    readSync: () => window.localStorage.getItem(screenStorageKey),
    readBackupSync: () => window.localStorage.getItem(screenStorageKey + ':backup'),
    read: async () => window.localStorage.getItem(screenStorageKey),
    readViewSync: () => window.sessionStorage.getItem(screenViewKey) ?? window.localStorage.getItem(screenViewKey),
    writeView: async value => {
      // A new browser session restores the last screen; already-open tabs retain
      // their own presentation. Neither write includes shared card/chat content.
      // Persist first so a failed durable write cannot look saved on a tab reload.
      window.localStorage.setItem(screenViewKey, value);
      window.sessionStorage.setItem(screenViewKey, value);
    },
    async write(value, expected) {
      if (inspect(value).kind !== 'valid') throw new Error('Invalid screen content');
      // Without a cross-window lock, a read followed by setItem is not a CAS.
      // Fail closed on unsupported browsers instead of risking another writer.
      if (!navigator.locks) throw new Error('Safe screen storage requires Web Locks');
      await navigator.locks.request(screenStorageKey, () => {
        const previous = window.localStorage.getItem(screenStorageKey);
        if (previous !== expected) throw new ScreenStorageConflict();
        if (inspect(previous).kind === 'unsupported') throw new Error('Unsupported screen format');
        // A failed replacement must leave a good primary or the recovery backup.
        if (inspect(previous).kind === 'valid') window.localStorage.setItem(screenStorageKey + ':backup', previous!);
        window.localStorage.setItem(screenStorageKey, value);
      });
    },
  };
}
