import {screenStorageKey, type ScreenStorage} from './screenPersistence';

export function createScreenStorage(): ScreenStorage {
  return {
    readSync: () => window.localStorage.getItem(screenStorageKey),
    readBackupSync: () => window.localStorage.getItem(screenStorageKey + ':backup'),
    read: async () => window.localStorage.getItem(screenStorageKey),
    async write(value) {
      const previous = window.localStorage.getItem(screenStorageKey);
      if (previous) window.localStorage.setItem(screenStorageKey + ':backup', previous);
      // setItem is atomic: a quota error leaves the current snapshot intact.
      window.localStorage.setItem(screenStorageKey, value);
    },
  };
}
