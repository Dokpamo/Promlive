import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import {SerialDatabase, type SqlRow} from '../../ports/storage';

function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('storyloom-local-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('database');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('브라우저 기기 저장소를 열 수 없습니다. 저장 권한을 확인해 주세요.'));
  });
}
function read(store: IDBDatabase): Promise<Uint8Array | undefined> {
  return new Promise((resolve, reject) => {
    const tx = store.transaction('database', 'readonly');
    const request = tx.objectStore('database').get('sqlite');
    request.onsuccess = () => resolve(request.result as Uint8Array | undefined);
    request.onerror = () => reject(request.error);
  });
}
function write(store: IDBDatabase, bytes: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = store.transaction('database', 'readwrite');
    tx.objectStore('database').put(bytes, 'sqlite');
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('저장 작업이 중단되었습니다.'));
    tx.onerror = () => reject(tx.error);
  });
}
export async function openDatabase() {
  // Prevent last-writer-wins database replacement across browser tabs.
  if (!navigator.locks) throw new Error('이 브라우저는 안전한 로컬 저장을 지원하지 않습니다. 최신 브라우저를 사용해 주세요.');
  let release!: () => void;
  await new Promise<void>((resolve, reject) => {
    void navigator.locks.request('storyloom-sqlite-owner', {ifAvailable: true}, async lock => {
      if (!lock) { reject(new Error('Promlive가 다른 탭에서 열려 있습니다. 그 탭을 닫고 다시 열어 주세요.')); return; }
      await new Promise<void>(done => { release = done; resolve(); });
    }).catch(reject);
  });
  try {
    const store = await openStore();
    const SQL = await initSqlJs({locateFile: () => wasmUrl});
    const database = new SQL.Database(await read(store));
    let dirty = false;
    return new SerialDatabase({
      async execute(sql, params = []) {
        const statement = database.prepare(sql);
        const rows: SqlRow[] = [];
        try { statement.bind([...params]); while (statement.step()) rows.push(statement.getAsObject()); }
        finally { statement.free(); }
        if (!/^\s*(SELECT|PRAGMA (foreign_keys|user_version)$)/i.test(sql)) dirty = true;
        return {rows, changes: database.getRowsModified()};
      },
      async persist() { if (dirty) { const bytes = database.export(); await write(store, bytes); database.run('PRAGMA foreign_keys = ON'); dirty = false; } },
      async close() { database.close(); store.close(); release(); },
    });
  } catch (error) { release(); throw error; }
}
