import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {createScreenStorage} from '../src/ui/screenStorage';
import {initialScreenData, decodeScreenSnapshot} from '../src/ui/screenState';
import {screenStorageKey, ScreenStorageConflict} from '../src/ui/screenPersistence';

const native = vi.hoisted(() => ({open: vi.fn()}));
vi.mock('@op-engineering/op-sqlite', () => native);
let directory: string;
let creates: number, failCreate: boolean;
let handles: Array<{db: DatabaseSync; closed: boolean}>;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'promlive-storage-test-')); handles = []; creates = 0; failCreate = false;
  native.open.mockReset().mockImplementation(() => {
    const handle = {db: new DatabaseSync(join(directory, 'memory.sqlite')), closed: false}; handles.push(handle);
    const executeSync = (sql: string, params: (string | number | null)[] = []) => {
      if (sql.startsWith('CREATE')) {creates++; if (failCreate) {failCreate = false; throw new Error('disk full');}}
      const statement = handle.db.prepare(sql);
      if (statement.columns().length) return {rows: statement.all(...params), rowsAffected: 0};
      return {rows: [], rowsAffected: Number(statement.run(...params).changes)};
    };
    return {executeSync, execute: async (sql: string, params?: (string | number | null)[]) => executeSync(sql, params),
      close: () => {handle.closed = true; handle.db.close();}};
  });
});
afterEach(() => {for (const handle of handles) if (!handle.closed) handle.db.close(); rmSync(directory, {recursive: true, force: true});});
const snapshot = (at: number) => JSON.stringify({version: 1, savedAt: at, data: initialScreenData()});

it('closes a failed initialization candidate and retries on the same storage instance', async () => {
  failCreate = true; const storage = createScreenStorage();
  expect(() => storage.readSync()).toThrow('disk full'); expect(handles[0]!.closed).toBe(true);
  const content = snapshot(1);
  await storage.write(content, null);
  expect(creates).toBe(2); expect(native.open).toHaveBeenCalledTimes(2);
  expect(storage.readSync()).toBe(content);
  storage.readBackupSync(); expect(creates).toBe(2);
});
it('uses a SQLite conditional update so concurrent instances cannot overwrite a newer snapshot', async () => {
  const a = createScreenStorage(), b = createScreenStorage(), first = snapshot(1), next = snapshot(2);
  await a.write(first, null);
  const results = await Promise.allSettled([a.write(next, first), b.write(snapshot(3), first)]);
  expect(results[0]!.status).toBe('fulfilled'); expect(results[1]).toMatchObject({status: 'rejected', reason: expect.any(ScreenStorageConflict)});
  expect(a.readSync()).toBe(next); expect(a.readBackupSync()).toBe(first);
  await b.writeView('{"version":1,"view":{"tab":"settings"}}'); expect(a.readSync()).toBe(next);
});
it('does not rotate an invalid primary over the good backup when repairing it', async () => {
  const storage = createScreenStorage(), first = snapshot(1), next = snapshot(2);
  await storage.write(first, null); await storage.write(next, first);
  handles[0]!.db.prepare('UPDATE screen_memory SET value = ? WHERE id = ?').run('{broken', screenStorageKey);
  await storage.write(first, '{broken');
  expect(decodeScreenSnapshot(storage.readSync())).not.toBeNull(); expect(storage.readBackupSync()).toBe(first);
});
