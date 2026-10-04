import {open} from '@op-engineering/op-sqlite';
import {screenStorageKey, screenViewKey, ScreenStorageConflict, type ScreenStorage, type ScreenContentInspector} from '../../ports/screenStorage';

/** Separate from all legacy databases. Images remain bundled assets, not JSON blobs. */
export function createScreenStorage(inspect: ScreenContentInspector): ScreenStorage {
  let db: ReturnType<typeof open> | undefined;
  function database() {
    if (!db) {
      const candidate = open({name: 'promlive-ui-memory.sqlite'});
      try {
        candidate.executeSync('CREATE TABLE IF NOT EXISTS screen_memory (id TEXT PRIMARY KEY, value TEXT NOT NULL, backup TEXT)');
        db = candidate;
      } catch (error) {try {candidate.close();} catch { /* Preserve the initialization error. */ } throw error;}
    }
    return db;
  }
  return {
    readSync: () => database().executeSync('SELECT value FROM screen_memory WHERE id = ?', [screenStorageKey]).rows[0]?.value as string ?? null,
    readBackupSync: () => database().executeSync('SELECT backup FROM screen_memory WHERE id = ?', [screenStorageKey]).rows[0]?.backup as string ?? null,
    read: async () => (await database().execute('SELECT value FROM screen_memory WHERE id = ?', [screenStorageKey])).rows[0]?.value as string ?? null,
    readViewSync: () => database().executeSync('SELECT value FROM screen_memory WHERE id = ?', [screenViewKey]).rows[0]?.value as string ?? null,
    async writeView(value) {
      await database().execute('INSERT INTO screen_memory (id, value) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value', [screenViewKey, value]);
    },
    async write(value, expected) {
      if (inspect(value).kind !== 'valid' || inspect(expected).kind === 'unsupported') throw new Error('Invalid screen content');
      // One conditional statement supplies both conflict detection and atomic backup rotation.
      const result = expected === null
        ? await database().execute('INSERT INTO screen_memory (id, value) VALUES (?, ?) ON CONFLICT(id) DO NOTHING', [screenStorageKey, value])
        : await database().execute('UPDATE screen_memory SET backup = CASE WHEN ? THEN value ELSE backup END, value = ? WHERE id = ? AND value = ?',
          [inspect(expected).kind === 'valid' ? 1 : 0, value, screenStorageKey, expected]);
      if (result.rowsAffected !== 1) throw new ScreenStorageConflict();
    },
  };
}
