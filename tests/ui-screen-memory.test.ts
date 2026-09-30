import {expect, it, vi} from 'vitest';
import {ScreenMemory} from '../src/ui/ScreenMemory';
import {decodeScreenSnapshot, initialScreenData, initialScreenView, type ScreenSnapshot} from '../src/ui/screenState';
import type {ScreenStorage} from '../src/ui/screenPersistence';

function storage(initial: string | null = null) {
  let raw = initial;
  let backup: string | null = null;
  const port: ScreenStorage = {readSync: () => raw, readBackupSync: () => backup, read: async () => raw,
    write: vi.fn(async value => {backup = raw; raw = value;})};
  return port;
}
function snapshot(): ScreenSnapshot {
  return {version: 1, savedAt: 1, data: initialScreenData(), view: initialScreenView(), positions: {}};
}

it('restores the last tab, filters, search, scroll, open editor and unpublished edits before any async read', async () => {
  const disk = storage();
  const first = new ScreenMemory(disk);
  first.updateView(view => ({...view, tab: 'create', creationFilter: 'mine', openedCardId: 'draft-1',
    searches: {...view.searches, create: {open: true, query: '계속 작성'}}}));
  first.dispatchCard({type: 'edit', id: 'draft-1', field: 'title', value: '계속 작성할 초안', now: 100});
  first.rememberScroll('create', {offset: 240, hidden: 24, height: 120, maxOffset: 800});
  await first.flush();
  const read = vi.spyOn(disk, 'read');
  const reopened = new ScreenMemory(disk);
  expect(read).not.toHaveBeenCalled();
  expect(reopened.getSnapshot().view).toEqual(first.getSnapshot().view);
  expect(reopened.getScroll('create').offset).toBe(240);
  const draft = reopened.getSnapshot().data.cards.find(card => card.id === 'draft-1')!;
  expect(draft.draft.title).toBe('계속 작성할 초안');
  expect(draft.published).toBeNull();
});

it('keeps cached content visible while revalidating, updates only changed records and preserves view state', async () => {
  const disk = storage(JSON.stringify(snapshot()));
  const memory = new ScreenMemory(disk);
  const before = memory.getSnapshot().data;
  let resolve!: (value: typeof before) => void;
  const load = vi.fn(() => new Promise<typeof before>(done => {resolve = done;}));
  const refreshing = memory.refresh(load);
  expect(memory.getSnapshot().data).toBe(before);
  expect(memory.refresh(load)).toBe(refreshing);
  memory.updateView(view => ({...view, tab: 'chats'}));
  memory.rememberScroll('chats', {offset: 352, hidden: 64, height: 64, maxOffset: 700});
  resolve({...before, chats: before.chats.map((chat, index) => index === 0 ? {...chat, lastAssistantMessage: '새로운 메시지'} : {...chat})});
  await refreshing;
  expect(load).toHaveBeenCalledTimes(1);
  expect(memory.getSnapshot().data.cards).toBe(before.cards);
  expect(memory.getSnapshot().data.chats[1]).toBe(before.chats[1]);
  expect(memory.getSnapshot().data.chats[0]!.lastAssistantMessage).toBe('새로운 메시지');
  expect(memory.getSnapshot().view.tab).toBe('chats');
  expect(memory.getScroll('chats').offset).toBe(352);
  await memory.flush();
});

it('does not rerender or replace content when fresh data is identical or refresh fails', async () => {
  const memory = new ScreenMemory(storage(JSON.stringify(snapshot())));
  const before = memory.getSnapshot();
  const changed = vi.fn(); memory.subscribe(changed);
  await memory.refresh(async () => JSON.parse(JSON.stringify(before.data)));
  await memory.refresh(async () => {throw new Error('offline');});
  expect(memory.getSnapshot()).toBe(before);
  expect(changed).not.toHaveBeenCalled();
});

it('never lets a slow refresh erase a newer local draft', async () => {
  const disk = storage(JSON.stringify(snapshot()));
  const memory = new ScreenMemory(disk);
  const old = memory.getSnapshot().data;
  let finish!: (value: typeof old) => void;
  const refreshing = memory.refresh(() => new Promise(done => {finish = done;}));
  memory.dispatchCard({type: 'edit', id: 'draft-1', field: 'summary', value: '지금 입력한 내용', now: 200});
  finish(old);
  await refreshing; await memory.flush();
  expect(new ScreenMemory(disk).getSnapshot().data.cards.find(card => card.id === 'draft-1')!.draft.summary).toBe('지금 입력한 내용');
});

it('serializes pending writes and saves the latest change after a slow disk operation', async () => {
  const disk = storage(JSON.stringify(snapshot()));
  const persisted: string[] = [];
  let unblock!: () => void;
  disk.write = vi.fn(async value => {
    if (!persisted.length) await new Promise<void>(done => {unblock = done;});
    persisted.push(value);
  });
  const memory = new ScreenMemory(disk);
  memory.updateView(view => ({...view, tab: 'chats'}));
  memory.updateView(view => ({...view, tab: 'settings'}));
  unblock(); await memory.flush();
  expect(disk.write).toHaveBeenCalledTimes(2);
  expect(decodeScreenSnapshot(persisted.at(-1)!)!.view.tab).toBe('settings');
});

it('retains memory after a storage failure and retries without clearing content', async () => {
  const disk = storage(JSON.stringify(snapshot()));
  const write = disk.write;
  disk.write = async () => {throw new Error('disk full');};
  const memory = new ScreenMemory(disk);
  memory.dispatchCard({type: 'edit', id: 'draft-1', field: 'title', value: '보존할 제목', now: 3});
  await memory.flush();
  expect(memory.getSnapshot().saveError).toBe(true);
  await memory.refresh();
  expect(memory.getSnapshot().data.cards.find(card => card.id === 'draft-1')!.draft.title).toBe('보존할 제목');
  const load = vi.fn(async () => snapshot().data);
  await memory.refresh(load);
  expect(load).not.toHaveBeenCalled();
  disk.write = write;
  await memory.flush();
  expect(memory.getSnapshot().saveError).toBe(false);
  expect(new ScreenMemory(disk).getSnapshot().data.cards.find(card => card.id === 'draft-1')!.draft.title).toBe('보존할 제목');
});

it('uses the previous valid snapshot if the current one is damaged and rejects invalid records', () => {
  const valid = snapshot(); valid.view.tab = 'settings';
  const disk = storage('{broken'); disk.readBackupSync = () => JSON.stringify(valid);
  expect(new ScreenMemory(disk).getSnapshot().view.tab).toBe('settings');
  expect(decodeScreenSnapshot(JSON.stringify({...valid, version: 99}))).toBeNull();
  const invalid = JSON.parse(JSON.stringify(valid)); invalid.data.cards[0].draft.tile = -1;
  expect(decodeScreenSnapshot(JSON.stringify(invalid))).toBeNull();
  const duplicate = {...valid, data: {...valid.data, chats: [valid.data.chats[0], valid.data.chats[0]]}};
  expect(decodeScreenSnapshot(JSON.stringify(duplicate))).toBeNull();
});

it('saves scroll without rerendering the page on every event', async () => {
  const disk = storage(JSON.stringify(snapshot()));
  const memory = new ScreenMemory(disk);
  const listener = vi.fn(); memory.subscribe(listener);
  for (let offset = 1; offset <= 30; offset++) memory.rememberScroll('library', {offset, hidden: offset, height: 120, maxOffset: 600});
  expect(listener).not.toHaveBeenCalled();
  expect(disk.write).not.toHaveBeenCalled();
  await memory.flush();
  expect(disk.write).toHaveBeenCalledTimes(1);
  expect(new ScreenMemory(disk).getScroll('library').offset).toBe(30);
});
