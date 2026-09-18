import {open} from '@op-engineering/op-sqlite';
import {SerialDatabase, type SqlRow} from '../../ports/storage';
export async function openDatabase() {
  const native = open({name: 'storyloom.sqlite'});
  return new SerialDatabase({
    async execute(sql, params = []) { const result = await native.execute(sql, [...params]); return {rows: result.rows as SqlRow[], changes: result.rowsAffected}; },
    async close() { native.close(); },
  });
}
