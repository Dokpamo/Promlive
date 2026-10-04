import {open} from '@op-engineering/op-sqlite';
import {SerialDatabase} from '../adapters/sqlite/SerialDatabase';
import {type SqlRow} from '../ports/storage';
import {SqliteWorkspace} from '../adapters/sqlite/SqliteWorkspace';
import {workspaceDatabase, type WorkspaceCache} from '../ports/workspace';

export function createWorkspace(name = workspaceDatabase) {
  const native = open({name: `${name}.sqlite`});
  native.executeSync('CREATE TABLE IF NOT EXISTS pl_cache (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
  const db = new SerialDatabase({async execute(sql, params = []) {
    const result = await native.execute(sql, [...params]); return {rows: result.rows as SqlRow[], changes: result.rowsAffected};
  }, async close() {native.close();}});
  const cache: WorkspaceCache = {
    read: () => native.executeSync('SELECT value FROM pl_cache WHERE id=1').rows[0]?.value as string ?? null,
    async write(value) {await db.execute('INSERT INTO pl_cache VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value', [value]);},
  };
  return {store: new SqliteWorkspace(db), cache};
}
