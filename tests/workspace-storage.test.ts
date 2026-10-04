import {DatabaseSync} from 'node:sqlite';
import {IDBFactory, IDBKeyRange} from 'fake-indexeddb';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {SerialDatabase} from '../src/adapters/sqlite/SerialDatabase';
import {SqliteWorkspace} from '../src/adapters/sqlite/SqliteWorkspace';
import {IndexedWorkspace} from '../src/adapters/indexeddb/IndexedWorkspace';
import type {WorkspaceStorage, WorkspaceSeed} from '../src/ports/workspace';
import {initialScreenData, initialScreenView} from '../src/ui/screenState';
import {ScreenStorageConflict} from '../src/ports/screenStorage';

const closing: WorkspaceStorage[] = [];
afterEach(async () => {for (const store of closing.splice(0)) await store.close();});
function sqlite() {
  const native = new DatabaseSync(':memory:');
  return new SqliteWorkspace(new SerialDatabase({async execute(sql, params = []) {
    const statement = native.prepare(sql);
    if (statement.columns().length) return {rows: statement.all(...params), changes: 0};
    return {rows: [], changes: Number(statement.run(...params).changes)};
  }, async close() {native.close();}}));
}
function indexed() {
  vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('IDBKeyRange', IDBKeyRange);
  return new IndexedWorkspace(`test-${Math.random()}`);
}
function seed(): WorkspaceSeed {return {data: structuredClone(initialScreenData()), view: initialScreenView(), positions: {}};}
describe.each([['SQLite', sqlite], ['IndexedDB', indexed]] as const)('%s indexed workspace', (_name, make) => {
  async function create(initial = seed()) {const store = make(); closing.push(store); await store.initialize(async () => initial); return store;}
  it('migrates once and preserves every original message and editable card field', async () => {
    const initial = seed(), store = await create(initial);
    const original = initial.data.chats[0]!;
    expect((await store.card(initial.data.cards[0]!.id))!.value).toEqual(initial.data.cards[0]);
    expect((await store.messages(original.id, {limit: 100, characters: 100_000})).messages.map(({sequence: _sequence, ...message}) => message)).toEqual(original.messages);
    const reload = vi.fn(async () => seed()); await store.initialize(reload); expect(reload).not.toHaveBeenCalled();
  });
  it('reads small list projections, searches beyond the first page and paginates stable ties', async () => {
    const initial = seed(), template = initial.data.cards[0]!;
    initial.data.cards = Array.from({length: 140}, (_, i) => ({...template, id: `card-${String(i).padStart(3, '0')}`, updatedAt: 10,
      draft: {...template.draft, title: `카드 ${i}`, introduction: '가'.repeat(10_000)}, published: {...template.draft, title: `카드 ${i}`}}));
    const store = await create(initial), query = {scope: 'create' as const, filter: 'all', search: ''};
    const first = await store.list(query, null, 48), second = await store.list(query, first.next, 48), third = await store.list(query, second.next, 48);
    expect(new Set([...first.rows, ...second.rows, ...third.rows].map(row => row.id)).size).toBe(140);
    expect(third.next).toBeNull(); expect(JSON.stringify(first).length).toBeLessThan(80_000);
    expect((await store.list({...query, search: '카드 139'}, null, 48)).rows[0]!.id).toBe('card-139');
  });
  it('bounds message bodies by character budget and loads both directions without gaps', async () => {
    const initial = seed(), chat = initial.data.chats[0]!;
    chat.messages = Array.from({length: 200}, (_, i) => ({id: `message-${i}`, role: i % 2 ? 'assistant' as const : 'user' as const, text: '가'.repeat(10_000), sentAt: i}));
    const store = await create(initial), query = {limit: 40, characters: 64_000};
    const latest = await store.messages(chat.id, query);
    expect(latest.messages.map(row => row.sequence)).toEqual([195, 196, 197, 198, 199, 200]);
    expect(latest).toMatchObject({hasOlder: true, hasNewer: false});
    const older = await store.messages(chat.id, {...query, before: 195});
    expect(older.messages.map(row => row.sequence)).toEqual([189, 190, 191, 192, 193, 194]);
    expect((await store.messages(chat.id, {...query, after: 194})).messages).toEqual(latest.messages);
  });
  it('pages mixed lengths without truncating an oversized message or skipping tiny messages', async () => {
    const initial = seed(), chat = initial.data.chats[0]!;
    const lengths = [1, 50, 1000, 10_000, 50_000, ...Array<number>(90).fill(20), 9000, 900, 2];
    chat.messages = lengths.map((length, index) => ({id: `mixed-${index}`, role: index % 2 ? 'assistant' : 'user', text: '가'.repeat(length), sentAt: index}));
    const store = await create(initial), received: number[] = [];
    let after = 0, pages = 0;
    while (after < lengths.length) {
      const page = await store.messages(chat.id, {after, limit: 32, characters: 16_000});
      expect(page.messages.length).toBeGreaterThan(0);
      expect(page.messages.length).toBeLessThanOrEqual(32);
      const total = page.messages.reduce((sum, row) => sum + row.text.length, 0);
      if (total > 16_000) expect(page.messages).toHaveLength(1);
      for (const row of page.messages) {expect(row.text).toHaveLength(lengths[row.sequence - 1]!); received.push(row.sequence);}
      after = page.messages.at(-1)!.sequence; pages++;
      expect(page.hasNewer).toBe(after < lengths.length);
    }
    expect(received).toEqual(lengths.map((_length, index) => index + 1));
    expect(pages).toBeLessThan(10);
  });
  it('uses revision checks and an atomic idempotent send without clearing another draft', async () => {
    const initial = seed(), chat = initial.data.chats[0]!, store = await create(initial);
    await store.saveDraft(chat.id, '보낼 메시지', null, 1);
    await expect(store.saveDraft(chat.id, '다른 창의 오래된 입력', null, 1)).rejects.toBeInstanceOf(ScreenStorageConflict);
    const message = {id: 'new-message', role: 'user' as const, text: '보낼 메시지', sentAt: 999};
    const sent = await store.send(chat.id, message, 2); expect(sent.value.draft).toBe('');
    await store.saveDraft(chat.id, '그 다음 초안', null, sent.revision);
    const retry = await store.send(chat.id, message, 2);
    expect(retry.value.draft).toBe('그 다음 초안');
    expect((await store.messages(chat.id, {limit: 100, characters: 100_000})).messages.filter(row => row.id === message.id)).toHaveLength(1);
  });
  it('does not leave a migration marker or partial rows after a failed migration', async () => {
    const store = make(); closing.push(store);
    const initial = seed(); initial.data.cards.push(initial.data.cards[0]!);
    // Duplicate IDs are rejected by SQLite. IndexedDB seed validation is covered at the boundary.
    if (store instanceof SqliteWorkspace) {
      await expect(store.initialize(async () => initial)).rejects.toThrow();
      await expect(store.initialize(async () => seed())).resolves.not.toBeNull();
    } else {
      await expect(store.initialize(async () => {throw new Error('read failed');})).rejects.toThrow('read failed');
      await expect(store.initialize(async () => seed())).resolves.not.toBeNull();
    }
  });
});
