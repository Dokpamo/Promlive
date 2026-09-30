import {open} from '@op-engineering/op-sqlite';
import {screenStorageKey, type ScreenStorage} from './screenPersistence';

/** Separate from all legacy databases. Images remain bundled assets, not JSON blobs. */
export function createScreenStorage(): ScreenStorage {
  let db: ReturnType<typeof open> | undefined;
  function database() {
    if (!db) {
      db = open({name: 'promlive-ui-memory.sqlite'});
      db.executeSync('CREATE TABLE IF NOT EXISTS screen_memory (id TEXT PRIMARY KEY, value TEXT NOT NULL, backup TEXT)');
    }
    return db;
  }
  return {
    readSync: () => database().executeSync('SELECT value FROM screen_memory WHERE id = ?', [screenStorageKey]).rows[0]?.value as string ?? null,
    readBackupSync: () => database().executeSync('SELECT backup FROM screen_memory WHERE id = ?', [screenStorageKey]).rows[0]?.backup as string ?? null,
    read: async () => (await database().execute('SELECT value FROM screen_memory WHERE id = ?', [screenStorageKey])).rows[0]?.value as string ?? null,
    async write(value) {
      await database().executeBatch([[
        'INSERT INTO screen_memory (id, value) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET backup = screen_memory.value, value = excluded.value',
        [screenStorageKey, value],
      ]]);
    },
  };
}
