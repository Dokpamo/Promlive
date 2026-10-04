import {IDBFactory, IDBKeyRange} from 'fake-indexeddb';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {IndexedWorkspace} from '../src/ui/workspace/IndexedWorkspace';
import {WorkspaceMemory} from '../src/ui/workspace/WorkspaceMemory';
import {WorkspaceRoom} from '../src/ui/workspace/Room';
import {initialScreenData, initialScreenView, type ScreenSnapshot} from '../src/ui/screenState';
import type {ScreenStorage} from '../src/ui/screenPersistence';
import {workspaceTuning} from '../src/ui/workspace/tuning';

const stores: IndexedWorkspace[] = [];
const memories: WorkspaceMemory[] = [];
beforeEach(() => {vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('IDBKeyRange', IDBKeyRange);});
afterEach(async () => {for (const memory of memories.splice(0)) await memory.flush(); for (const store of stores.splice(0)) await store.close(); vi.restoreAllMocks();});
function setup(snapshot?: ScreenSnapshot) {
  let cacheValue: string | null = null;
  const raw = snapshot ? JSON.stringify(snapshot) : null;
  const legacy: ScreenStorage = {read: vi.fn(async () => raw), readSync: () => raw, readBackupSync: () => null,
    readViewSync: () => null, write: vi.fn(), writeView: vi.fn()};
  const cache = {read: () => cacheValue, write: vi.fn(async (value: string) => {cacheValue = value;})};
  const store = new IndexedWorkspace(`memory-${Math.random()}`); stores.push(store);
  const memory = new WorkspaceMemory(legacy, store, cache); memories.push(memory);
  return {memory, store, cache, legacy};
}
function snapshot(): ScreenSnapshot {return {version: 1, savedAt: 1, data: structuredClone(initialScreenData()), view: initialScreenView(), positions: {}};}
const deferred = () => {let resolve!: () => void; return {promise: new Promise<void>(done => {resolve = done;}), resolve: () => resolve()};};

describe('bounded workspace memory', () => {
  it('does not deserialize legacy content after a completed migration', async () => {
    const {memory, store, legacy, cache} = setup(snapshot()); await memory.initialize(); await memory.flush();
    const later = new WorkspaceMemory(legacy, store, cache); memories.push(later); await later.initialize();
    expect(legacy.read).toHaveBeenCalledTimes(1); expect(legacy.write).not.toHaveBeenCalled();
  });
  it('keeps later typing behind an in-flight save and send, including repeated sends', async () => {
    const {memory, store} = setup(snapshot()); await memory.initialize();
    const id = initialScreenData().chats[0]!.id; await memory.prepareChat(id);
    const gate = deferred(), started = deferred(), save = store.saveDraft.bind(store);
    vi.spyOn(store, 'saveDraft').mockImplementationOnce(async (...args) => {started.resolve(); await gate.promise; return save(...args);});
    memory.updateChatDraft(id, '첫 메시지'); const flush = memory.flush(); await started.promise;
    const first = memory.sendChat(id)!; memory.updateChatDraft(id, '둘째 메시지'); const second = memory.sendChat(id)!;
    memory.updateChatDraft(id, '남겨 둔 초안'); gate.resolve(); await flush; await memory.flush();
    expect((await store.chat(id))!.value.draft).toBe('남겨 둔 초안');
    const messages = (await store.messages(id, {limit: 100, characters: 100_000})).messages;
    expect(messages.slice(-2).map(row => row.text)).toEqual(['첫 메시지', '둘째 메시지']);
    expect(memory.room(id)!.snapshot().messages.slice(-2).map(row => row.id)).toEqual([first.id, second.id]);
    expect(memory.getSnapshot().saveError).toBe(false);
  });
  it('keeps an oversized selected card out of the cache without losing its route or document', async () => {
    const initial = snapshot(), card = initial.data.cards[0]!; card.draft.introduction = '가'.repeat(150_000);
    initial.view.openedCardId = card.id;
    const {memory, store, cache, legacy} = setup(initial); await memory.initialize(); await memory.prepareCard(card.id); await memory.flush();
    expect(cache.read()!.length).toBeLessThanOrEqual(workspaceTuning.cacheCharacters);
    const later = new WorkspaceMemory(legacy, store, cache); memories.push(later);
    expect(later.getSnapshot().view.openedCardId).toBe(card.id);
    await later.refresh(); expect(later.getSnapshot().data.cards[0]!.draft.introduction.length).toBe(150_000);
  });
  it('preserves a read position for a room that is not the currently cached room', async () => {
    const {memory, store, cache, legacy} = setup(); await memory.initialize();
    memory.rememberScroll('chat:archived-room', {offset: 123, maxOffset: 1000, height: 0, hidden: 0,
      anchor: {id: 'old-message', sequence: 1900, offset: -85}}); await memory.flush();
    const later = new WorkspaceMemory(legacy, store, cache); memories.push(later);
    expect(later.getScroll('chat:archived-room').anchor).toEqual({id: 'old-message', sequence: 1900, offset: -85});
  });
  it('keeps a large saved draft out of the startup cache and hydrates it without loss', async () => {
    const {memory, store, cache, legacy} = setup(snapshot()); await memory.initialize();
    const id = initialScreenData().chats[0]!.id; await memory.prepareChat(id);
    memory.updateView(view => ({...view, tab: 'chats', chatId: id}));
    memory.updateChatDraft(id, '가'.repeat(150_000)); await memory.flush();
    expect(cache.read()!.length).toBeLessThanOrEqual(workspaceTuning.cacheCharacters);
    const later = new WorkspaceMemory(legacy, store, cache); memories.push(later);
    expect(later.getSnapshot().view.chatId).toBe(id);
    await later.prepareChat(id); expect(later.room(id)!.snapshot().chat.draft).toHaveLength(150_000);
  });
  it('retains only nearby bodies and returns evicted messages from either direction', async () => {
    const initial = snapshot(), chat = initial.data.chats[0]!;
    chat.messages = Array.from({length: 100}, (_, i) => ({id: `m-${i+1}`, role: 'user', text: '가'.repeat(10_000), sentAt: i}));
    const {store, memory} = setup(initial); await memory.initialize(); await memory.prepareChat(chat.id);
    const room = memory.room(chat.id)!;
    for (let i = 0; i < 25; i++) await room.older();
    room.retain('m-80', 'm-80');
    expect(room.snapshot().messages.reduce((sum, row) => sum + row.text.length, 0)).toBeLessThanOrEqual(workspaceTuning.retainedCharacters);
    expect(room.snapshot().messages.some(row => row.id === 'm-80')).toBe(true);
    expect(room.snapshot()).toMatchObject({hasOlder: true, hasNewer: true});
    await room.latest(); expect(room.snapshot().messages.at(-1)!.sequence).toBe(100);
    await room.load(40); expect(room.snapshot().messages.some(row => row.sequence === 40)).toBe(true);
    memory.updateChatDraft(chat.id, '이전 대화를 읽다가 전송'); memory.sendChat(chat.id); await memory.flush();
    expect(room.snapshot().messages.map(row => row.sequence)).toEqual([101]);
    await room.older(); expect(room.snapshot().messages.at(-2)!.sequence).toBe(100);
    expect((await store.chat(chat.id))!.value.lastSequence).toBe(101);
  });
  it('ignores an obsolete history request when sending from an older window', async () => {
    const initial = snapshot(), {store, memory} = setup(initial); await memory.initialize();
    const chat = initial.data.chats[0]!;
    const room = new WorkspaceRoom(store, {...chat, lastSequence: 100} as typeof chat);
    const gate = deferred(), read = store.messages.bind(store);
    vi.spyOn(store, 'messages').mockImplementationOnce(async (...args) => {await gate.promise; return read(...args);});
    const pending = room.load();
    room.append({id: 'optimistic', sequence: 101, text: 'new', role: 'user', sentAt: 123});
    gate.resolve(); await pending;
    expect(room.snapshot().messages.at(-1)!.id).toBe('optimistic');
  });
  it('keeps an even message-count budget exact around one visible short message', async () => {
    const initial = snapshot(), chat = initial.data.chats[0]!;
    chat.messages = Array.from({length: 400}, (_, i) => ({id: `short-${i}`, role: 'user', text: '짧음', sentAt: i}));
    const {store} = setup(initial);
    const room = new WorkspaceRoom(store, chat);
    room.retain('short-200', 'short-200');
    expect(room.snapshot().messages).toHaveLength(workspaceTuning.retainedMessages);
    expect(room.snapshot().messages.some(row => row.id === 'short-200')).toBe(true);
  });
  it('bounds retained bodies after repeated sends, while preserving every stored message', async () => {
    const {memory, store} = setup(snapshot()); await memory.initialize();
    const id = initialScreenData().chats[0]!.id; await memory.prepareChat(id);
    const before = (await store.chat(id))!.value.lastSequence;
    for (let i = 0; i < 20; i++) {memory.updateChatDraft(id, `${i}:` + '가'.repeat(10_000)); memory.sendChat(id);}
    await memory.flush();
    const room = memory.room(id)!.snapshot();
    expect(room.messages.reduce((sum, row) => sum + row.text.length, 0)).toBeLessThanOrEqual(workspaceTuning.retainedCharacters);
    expect(room.hasOlder).toBe(true);
    expect((await store.chat(id))!.value.lastSequence).toBe(before + 20);
    expect((await store.messages(id, {after: before, characters: 300_000, limit: 30})).messages).toHaveLength(20);
  });
  it('keeps the saved draft when an existing room is reopened through its card', async () => {
    const initial = snapshot(), chat = initial.data.chats[0]!;
    const card = initial.data.cards.find(item => item.id === chat.id)!;
    chat.draft = '이전에 작성한 초안';
    const {memory, store} = setup(initial); await memory.initialize();
    memory.ensureChat({...card.published!, id: card.id, activity: card.activity});
    await memory.flush(); await memory.prepareChat(chat.id);
    expect(memory.room(chat.id)!.snapshot().chat.draft).toBe(chat.draft);
    expect((await store.chat(chat.id))!.value.draft).toBe(chat.draft);
  });
  it('refreshes new messages from another window without pulling a reader out of older history', async () => {
    const {memory, store} = setup(snapshot()); await memory.initialize();
    const id = initialScreenData().chats[0]!.id; await memory.prepareChat(id);
    const before = (await store.chat(id))!;
    await store.send(id, {id: 'other-window-1', role: 'user', text: '다른 창', sentAt: 100}, before.revision);
    await memory.prepareChat(id);
    expect(memory.room(id)!.snapshot().messages.at(-1)!.id).toBe('other-window-1');
    memory.rememberScroll(`chat:${id}`, {offset: 50, maxOffset: 5000, height: 0, hidden: 0});
    await store.send(id, {id: 'other-window-2', role: 'user', text: '추가 메시지', sentAt: 101}, before.revision + 1);
    await memory.prepareChat(id);
    expect(memory.room(id)!.snapshot().messages.at(-1)!.id).toBe('other-window-1');
    expect(memory.room(id)!.snapshot().hasNewer).toBe(true);
    await memory.room(id)!.newer();
    expect(memory.room(id)!.snapshot().messages.at(-1)!.id).toBe('other-window-2');
  });
  it('revalidates visited filter rows after a record leaves that filter', async () => {
    const initial = snapshot(), template = initial.data.cards[0]!;
    initial.data.cards = Array.from({length: 120}, (_, i) => ({...template, id: `card-${i}`, working: true, updatedAt: 1000 - i}));
    const {memory, store} = setup(initial); await memory.initialize();
    const collection = memory.collection({scope: 'create', filter: 'draft', search: ''});
    await collection.load(); while (collection.snapshot().rows.length < 96) await collection.loadMore();
    const card = (await store.card('card-70'))!;
    await store.saveCard({...card.value, working: false}, card.revision);
    await collection.refresh();
    expect(collection.snapshot().rows.some(row => row.id === 'card-70')).toBe(false);
    expect(collection.snapshot().rows.length).toBe(96);
  });
  it('recovers the migrated route when its disposable cache could not be written', async () => {
    const initial = snapshot(); initial.view.tab = 'chats'; initial.view.chatId = initial.data.chats[0]!.id;
    const {memory, store, legacy} = setup(initial); await memory.initialize();
    const next = new WorkspaceMemory(legacy, store, {read: () => null, write: async () => {}}); memories.push(next);
    await next.initialize(); expect(next.getSnapshot().view.chatId).toBe(initial.view.chatId);
    expect(legacy.read).toHaveBeenCalledTimes(1);
  });
});
