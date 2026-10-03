import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {IDBFactory} from 'fake-indexeddb';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {openDatabase} from '../src/adapters/sqlite/open.web';
import {migrate} from '../src/adapters/sqlite/migrations';
import {Repository} from '../src/adapters/sqlite/repository';

const sql = vi.hoisted(() => ({init: vi.fn(), close: vi.fn(), construct: vi.fn()}));
vi.mock('sql.js', () => ({default: sql.init}));
let owner: {held: boolean};
let factory: IDBFactory;
let stores: IDBDatabase[], cleanup: Array<() => void>;
let readFailure: 'none' | 'transaction' | 'request';
let closeFailure: boolean;
beforeEach(() => {
  owner = {held: false}; stores = []; cleanup = []; readFailure = 'none'; closeFailure = false;
  const ownership = owner;
  sql.init.mockReset(); sql.close.mockReset(); sql.construct.mockReset();
  sql.construct.mockImplementation(() => ({close: sql.close}));
  sql.init.mockResolvedValue({Database: sql.construct});
  vi.stubGlobal('navigator', {locks: {async request(name: string, _options: unknown, callback: (lock: unknown) => Promise<unknown>) {
    if (ownership.held) return callback(null);
    ownership.held = true;
    try {return await callback({name});} finally {ownership.held = false;}
  }}});
  factory = new IDBFactory();
  const open = factory.open.bind(factory);
  vi.spyOn(factory, 'open').mockImplementation((...args) => {
    const request = open(...args);
    request.addEventListener('success', () => {
      const store = request.result, close = store.close.bind(store);
      stores.push(store); cleanup.push(close);
      vi.spyOn(store, 'close').mockImplementation(() => {close(); if (closeFailure) throw new Error('IDB close failed');});
      if (readFailure === 'transaction') vi.spyOn(store, 'transaction').mockImplementationOnce(() => {throw new Error('read failed');});
      if (readFailure === 'request') {
        const transaction = store.transaction.bind(store);
        vi.spyOn(store, 'transaction').mockImplementationOnce((...args) => {
          const tx = transaction(...args); queueMicrotask(() => tx.abort()); return tx;
        });
      }
    });
    return request;
  });
  vi.stubGlobal('indexedDB', factory);
});
afterEach(() => {for (const close of cleanup) close(); vi.restoreAllMocks(); vi.unstubAllGlobals();});

it.each(['WASM', 'read transaction', 'read request', 'SQL constructor'])('closes acquired stores after repeated %s failures and permits retry', async failure => {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (failure === 'WASM') sql.init.mockRejectedValueOnce(new Error('WASM failed'));
    if (failure === 'read transaction') readFailure = 'transaction';
    if (failure === 'read request') readFailure = 'request';
    if (failure === 'SQL constructor') sql.construct.mockImplementationOnce(() => {throw new Error('constructor failed');});
    await expect(openDatabase()).rejects.toThrow();
    expect(stores).toHaveLength(attempt + 1);
    expect(stores[attempt]!.close).toHaveBeenCalledOnce();
    expect(owner.held).toBe(false);
  }
  readFailure = 'none';
  const db = await openDatabase(); await db.close();
  expect(stores.at(-1)!.close).toHaveBeenCalledOnce(); expect(owner.held).toBe(false);
});

it('releases ownership when IndexedDB itself cannot open', async () => {
  vi.mocked(factory.open).mockImplementationOnce(() => {throw new Error('IDB open failed');});
  await expect(openDatabase()).rejects.toThrow('IDB open failed');
  expect(stores).toHaveLength(0); expect(owner.held).toBe(false);
  const db = await openDatabase(); await db.close(); expect(owner.held).toBe(false);
});

it('preserves the initialization error and releases ownership even if store cleanup also throws', async () => {
  const failure = new Error('original initialization error');
  closeFailure = true; sql.init.mockRejectedValueOnce(failure);
  await expect(openDatabase()).rejects.toBe(failure);
  expect(stores[0]!.close).toHaveBeenCalledOnce(); expect(owner.held).toBe(false);
});

it('closes IndexedDB and releases ownership when SQL close throws, then permits reopening', async () => {
  const db = await openDatabase();
  const failure = new Error('SQL close failed'); sql.close.mockImplementationOnce(() => {throw failure;});
  await expect(db.close()).rejects.toBe(failure);
  expect(stores[0]!.close).toHaveBeenCalledOnce(); expect(owner.held).toBe(false);
  const reopened = await openDatabase(); await reopened.close(); expect(owner.held).toBe(false);
});

it('releases ownership even if IndexedDB close throws', async () => {
  closeFailure = true;
  const db = await openDatabase();
  await expect(db.close()).rejects.toThrow('IDB close failed');
  expect(sql.close).toHaveBeenCalledOnce(); expect(owner.held).toBe(false);
});

it('does not acquire resources without Web Locks support', async () => {
  vi.stubGlobal('navigator', {});
  await expect(openDatabase()).rejects.toThrow('안전한 로컬 저장');
  expect(factory.open).not.toHaveBeenCalled(); expect(sql.init).not.toHaveBeenCalled();
});

it('keeps the existing owner when a second opener is refused and releases it on normal close', async () => {
  const db = await openDatabase();
  await expect(openDatabase()).rejects.toThrow('다른 탭');
  expect(stores).toHaveLength(1); expect(stores[0]!.close).not.toHaveBeenCalled(); expect(owner.held).toBe(true);
  await db.close();
  expect(stores[0]!.close).toHaveBeenCalledOnce(); expect(owner.held).toBe(false);
});

it('preserves real sql.js data across a failed initialization and a successful reopen', async () => {
  const require = createRequire(import.meta.url);
  const initialize = require('sql.js') as typeof import('sql.js');
  const SQL = await initialize({wasmBinary: Uint8Array.from(readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'))).buffer});
  sql.init.mockResolvedValue(SQL);
  const first = await openDatabase();
  await migrate(first); await new Repository(first).setSetting('lifecycle-test', '보존할 설정'); await first.close();
  sql.init.mockRejectedValueOnce(new Error('temporary WASM failure'));
  await expect(openDatabase()).rejects.toThrow('temporary WASM failure');
  expect(stores[1]!.close).toHaveBeenCalledOnce(); expect(owner.held).toBe(false);
  const reopened = await openDatabase();
  try {await migrate(reopened); expect(await new Repository(reopened).getSetting('lifecycle-test')).toBe('보존할 설정');}
  finally {await reopened.close();}
  expect(stores[2]!.close).toHaveBeenCalledOnce(); expect(owner.held).toBe(false);
});
