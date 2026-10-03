import {expect, it, vi} from 'vitest';
import {ScreenMemory} from '../src/ui/ScreenMemory';
import {decodeScreenSnapshot, initialScreenData, initialScreenView, type ScreenSnapshot} from '../src/ui/screenState';
import {ScreenStorageConflict, type ScreenStorage} from '../src/ui/screenPersistence';

function storage(initial: string | null = null) {
  let raw = initial;
  let backup: string | null = null;
  let view: string | null = null;
  const port: ScreenStorage = {readSync: () => raw, readBackupSync: () => backup, read: async () => raw,
    write: vi.fn(async (value, expected) => {if (raw !== expected) throw new ScreenStorageConflict(); if (decodeScreenSnapshot(raw)) backup = raw; raw = value;}),
    readViewSync: () => view, writeView: vi.fn(async value => {view = value;})};
  return port;
}
function snapshot(): ScreenSnapshot {
  return {version: 1, savedAt: 1, data: initialScreenData(), view: initialScreenView(), positions: {}};
}

function legacySnapshot(): ScreenSnapshot {
  const saved = snapshot();
  saved.view.tab = 'chats'; saved.view.chatId = 'night-library';
  saved.view.searches.chats = {open: true, query: '저장한 검색'};
  saved.positions['chat:night-library'] = {offset: 240, hidden: 0, height: 50, maxOffset: 800};
  return saved;
}
function expectLegacyView(memory: ScreenMemory, saved: ScreenSnapshot) {
  expect(memory.getSnapshot().view).toEqual(saved.view);
  expect(memory.getScroll('chat:night-library')).toEqual(saved.positions['chat:night-library']);
}

it.each(['normal', 'content read retry', 'view read retry', 'backup'])('migrates a legacy view before it can be lost by content-only edits: %s', async scenario => {
  const saved = legacySnapshot(), raw = JSON.stringify(saved);
  const disk = storage(scenario === 'backup' ? '{broken' : raw);
  if (scenario === 'backup') disk.readBackupSync = () => raw;
  if (scenario === 'content read retry') vi.spyOn(disk, 'readSync').mockImplementationOnce(() => {throw new Error('temporary read');});
  if (scenario === 'view read retry') vi.spyOn(disk, 'readViewSync').mockImplementationOnce(() => {throw new Error('temporary view read');});
  const memory = new ScreenMemory(disk);
  await memory.refresh();
  expectLegacyView(memory, saved);
  memory.updateChatDraft('night-library', '이관 후에도 남을 초안'); await memory.flush();
  const reopened = new ScreenMemory(disk);
  expectLegacyView(reopened, saved);
  expect(reopened.getSnapshot().data.chats.find(chat => chat.id === 'night-library')!.draft).toBe('이관 후에도 남을 초안');
  expect(disk.readViewSync()).not.toBeNull();
  expect(memory.getSnapshot().saveError).toBe(false);
});

it('keeps both the draft and legacy view durable when view migration fails, then retries and resumes content-only saves', async () => {
  const saved = legacySnapshot(), disk = storage(JSON.stringify(saved)), writeView = disk.writeView;
  disk.writeView = vi.fn(async () => {throw new Error('view write failed');});
  const memory = new ScreenMemory(disk);
  memory.updateChatDraft('night-library', '이관 중 수정'); await memory.flush();
  expect(memory.getSnapshot().storageIssue).toBe('write');
  expectLegacyView(new ScreenMemory(disk), saved);
  expect(decodeScreenSnapshot(disk.readSync())!.data.chats.find(chat => chat.id === 'night-library')!.draft).toBe('이관 중 수정');
  disk.writeView = writeView; await memory.flush();
  expect(memory.getSnapshot().saveError).toBe(false);
  memory.updateChatDraft('night-library', '이관 후 수정'); await memory.flush();
  expect(JSON.parse(disk.readSync()!).view).toBeUndefined();
  expectLegacyView(new ScreenMemory(disk), saved);
});

it('can reopen between the content write and completion of the first separate view write', async () => {
  const saved = legacySnapshot(), disk = storage(JSON.stringify(saved)), writeView = disk.writeView;
  let release!: () => void, start!: () => void;
  const started = new Promise<void>(done => {start = done;});
  disk.writeView = vi.fn(async value => {
    await new Promise<void>(done => {release = done; start();}); await writeView(value);
  });
  const memory = new ScreenMemory(disk);
  memory.updateChatDraft('night-library', '종료 직전 수정');
  await started;
  try {
    expect(disk.readViewSync()).toBeNull();
    const reopened = new ScreenMemory(disk);
    expectLegacyView(reopened, saved);
    expect(reopened.getSnapshot().data.chats.find(chat => chat.id === 'night-library')!.draft).toBe('종료 직전 수정');
  } finally {release(); await memory.flush();}
});

it('retains the recovered legacy fallback while the separate view store remains unreadable', async () => {
  const saved = legacySnapshot(), disk = storage(JSON.stringify(saved)), readView = disk.readViewSync;
  vi.spyOn(disk, 'readSync').mockImplementationOnce(() => {throw new Error('content read failed');});
  disk.readViewSync = () => {throw new Error('view read still failing');};
  const memory = new ScreenMemory(disk);
  await memory.refresh();
  expect(memory.getSnapshot().storageIssue).toBe('read');
  memory.updateChatDraft('night-library', '읽기 복구 중 수정'); await memory.flush();
  expect(disk.writeView).not.toHaveBeenCalled();
  disk.readViewSync = readView;
  const reopened = new ScreenMemory(disk);
  expectLegacyView(reopened, saved);
  expect(reopened.getSnapshot().data.chats.find(chat => chat.id === 'night-library')!.draft).toBe('읽기 복구 중 수정');
  await memory.refresh().then(memory.flush);
  expectLegacyView(memory, saved);
  expect(disk.readViewSync()).not.toBeNull();
  expect(memory.getSnapshot().saveError).toBe(false);
});

it('keeps an already separate view authoritative over an older embedded view', async () => {
  const disk = storage(JSON.stringify(legacySnapshot()));
  const separate = {...initialScreenView(), tab: 'settings' as const};
  await disk.writeView(JSON.stringify({version: 1, view: separate, positions: {}}));
  vi.mocked(disk.writeView).mockClear();
  const memory = new ScreenMemory(disk);
  memory.updateChatDraft('night-library', '내용만 수정'); await memory.flush();
  expect(JSON.parse(disk.readSync()!).view).toBeUndefined();
  expect(new ScreenMemory(disk).getSnapshot().view).toEqual(separate);
  expect(disk.writeView).not.toHaveBeenCalled();
});

function presentationFailure() {
  const disk = storage(JSON.stringify(snapshot()));
  const original = JSON.stringify({version: 1, view: {...initialScreenView(), themeMode: 'dark', tab: 'settings',
    searches: {...initialScreenView().searches, library: {open: true, query: '저장한 검색'}}},
    positions: {settings: {offset: 120, hidden: 0, height: 50, maxOffset: 500}}});
  let raw = original, failing = true;
  disk.readViewSync = vi.fn(() => {if (failing) throw new Error('temporary view read'); return raw;});
  disk.writeView = vi.fn(async value => {raw = value;});
  return {disk, original, raw: () => raw, recover: () => {failing = false;}};
}

it('retries the failed view store and restores theme, tab and scroll without replacing its bytes', async () => {
  const source = presentationFailure(), memory = new ScreenMemory(source.disk);
  for (let i = 0; i < 3; i++) await memory.refresh().then(memory.flush);
  expect(source.disk.readViewSync).toHaveBeenCalledTimes(4);
  expect(memory.getSnapshot().storageIssue).toBe('read');
  expect(source.raw()).toBe(source.original);
  expect(source.disk.writeView).not.toHaveBeenCalled();
  source.recover();
  await memory.refresh().then(memory.flush);
  expect(memory.getSnapshot()).toMatchObject({saveError: false, view: {themeMode: 'dark', tab: 'settings'}});
  expect(memory.getScroll('settings').offset).toBe(120);
  expect(source.disk.writeView).not.toHaveBeenCalled();
  expect(source.disk.write).not.toHaveBeenCalled();
});

it('preserves unread view fields while saving content and merging only intervening view edits on recovery', async () => {
  const source = presentationFailure(), memory = new ScreenMemory(source.disk);
  memory.updateView(view => ({...view, tab: 'create', searches: {...view.searches, chats: {open: true, query: '새 검색'}}}));
  memory.rememberScroll('create', {offset: 80, hidden: 0, height: 40, maxOffset: 200});
  memory.dispatchCard({type: 'edit', id: 'draft-1', field: 'title', value: '보존할 새 본문', now: 20});
  await memory.flush();
  expect(source.disk.write).toHaveBeenCalledTimes(1);
  expect(source.disk.writeView).not.toHaveBeenCalled();
  expect(source.raw()).toBe(source.original);
  expect(memory.getSnapshot().storageIssue).toBe('read');
  source.recover();
  await memory.refresh().then(memory.flush);
  expect(memory.getSnapshot()).toMatchObject({saveError: false, view: {themeMode: 'dark', tab: 'create',
    searches: {library: {open: true, query: '저장한 검색'}, chats: {open: true, query: '새 검색'}}}});
  expect(memory.getScroll('settings').offset).toBe(120);
  expect(memory.getScroll('create').offset).toBe(80);
  expect(source.disk.writeView).toHaveBeenCalledTimes(1);
  expect(decodeScreenSnapshot(source.disk.readSync())!.data.cards.find(card => card.id === 'draft-1')!.draft.title).toBe('보존할 새 본문');
});

it('never saves the recovery preview when the view is restored during a pending content write', async () => {
  const source = presentationFailure(), memory = new ScreenMemory(source.disk);
  let finishRead!: (data: ReturnType<typeof initialScreenData>) => void;
  const refreshing = memory.refresh(() => new Promise(done => {finishRead = done;}));
  let releaseWrite!: () => void, started!: () => void;
  const writing = new Promise<void>(done => {started = done;}), originalWrite = source.disk.write;
  source.disk.write = vi.fn(async (value, expected) => {
    await new Promise<void>(done => {releaseWrite = done; started();});
    await originalWrite(value, expected);
  });
  memory.dispatchCard({type: 'edit', id: 'draft-1', field: 'title', value: '저장 중인 본문', now: 21});
  await writing;
  source.recover(); finishRead(initialScreenData());
  await refreshing;
  expect(memory.getSnapshot().view.themeMode).toBe('dark');
  releaseWrite(); await memory.flush();
  expect(source.raw()).toBe(source.original);
  expect(source.disk.writeView).not.toHaveBeenCalled();
  expect(decodeScreenSnapshot(source.disk.readSync())!.data.cards.find(card => card.id === 'draft-1')!.draft.title).toBe('저장 중인 본문');
});

it.each(['{broken', '', JSON.stringify({version: 2, view: {themeMode: 'dark'}})])('does not overwrite an unreadable presentation: %s', async raw => {
  const disk = storage(JSON.stringify(snapshot()));
  disk.readViewSync = () => raw;
  const memory = new ScreenMemory(disk);
  memory.updateView(view => ({...view, tab: 'create'}));
  await memory.refresh().then(memory.flush);
  expect(memory.getSnapshot().saveError).toBe(true);
  expect(disk.writeView).not.toHaveBeenCalled();
  expect(disk.write).not.toHaveBeenCalled();
});

it('recovers independent content and view read failures without clearing the remaining error or losing references', async () => {
  const source = presentationFailure(), disk = source.disk;
  const saved = JSON.stringify({...snapshot(), view: {...initialScreenView(), themeMode: 'dark', chatId: 'night-library'}});
  let dataFails = true;
  disk.readSync = () => {throw new Error('content unavailable');};
  disk.read = async () => {if (dataFails) throw new Error('content unavailable'); return saved;};
  const memory = new ScreenMemory(disk);
  await memory.refresh().then(memory.flush);
  expect(memory.getSnapshot().data.cards).toEqual([]);
  dataFails = false;
  await memory.refresh().then(memory.flush);
  expect(memory.getSnapshot().data.cards.length).toBeGreaterThan(0);
  expect(memory.getSnapshot().storageIssue).toBe('read');
  expect(disk.writeView).not.toHaveBeenCalled();
  disk.readViewSync = () => JSON.stringify({version: 1, view: JSON.parse(saved).view, positions: {}});
  await memory.refresh().then(memory.flush);
  expect(memory.getSnapshot()).toMatchObject({saveError: false, view: {themeMode: 'dark', chatId: 'night-library'}});
  expect(disk.write).not.toHaveBeenCalled();
  expect(disk.writeView).not.toHaveBeenCalled();
});

it('does not replace shared content when another instance only changes its view or scroll', async () => {
  const disk = storage(JSON.stringify(snapshot()));
  const a = new ScreenMemory(disk), b = new ScreenMemory(disk);
  a.dispatchCard({type: 'edit', id: 'draft-1', field: 'title', value: '다른 창에서 저장한 제목', now: 10});
  await a.flush();
  b.updateView(view => ({...view, tab: 'settings'}));
  b.rememberScroll('library', {offset: 10, hidden: 0, height: 20, maxOffset: 100});
  await b.flush();
  expect(decodeScreenSnapshot(disk.readSync())!.data.cards.find(card => card.id === 'draft-1')!.draft.title).toBe('다른 창에서 저장한 제목');
  expect(disk.write).toHaveBeenCalledTimes(1);
  b.dispatchCard({type: 'edit', id: 'draft-1', field: 'title', value: '충돌한 창의 초안', now: 11});
  await b.flush(); await b.refresh();
  expect(b.getSnapshot()).toMatchObject({saveError: true, storageIssue: 'conflict'});
  expect(b.getSnapshot().data.cards.find(card => card.id === 'draft-1')!.draft.title).toBe('충돌한 창의 초안');
  expect(decodeScreenSnapshot(disk.readSync())!.data.cards.find(card => card.id === 'draft-1')!.draft.title).toBe('다른 창에서 저장한 제목');
});

it('preserves corrupt and unsupported primary/backup bytes without initializing or accepting edits', async () => {
  const saved = JSON.parse(JSON.stringify(snapshot()));
  saved.data.cards[0].draft.tile = -1;
  for (const raw of [JSON.stringify(saved), '{broken', '', JSON.stringify({...snapshot(), version: 2})]) {
    const disk = storage(raw); disk.readBackupSync = () => raw;
    const memory = new ScreenMemory(disk);
    await memory.refresh().then(memory.flush);
    memory.updateView(view => ({...view, tab: 'settings'}));
    memory.dispatchCard({type: 'edit', id: 'draft-1', field: 'title', value: 'must not be saved', now: 3});
    await memory.flush();
    expect(disk.readSync()).toBe(raw); expect(disk.readBackupSync()).toBe(raw);
    expect(disk.write).not.toHaveBeenCalled();
    expect(memory.getSnapshot().saveError).toBe(true);
    expect(memory.getSnapshot().data.cards).toEqual([]);
  }
  const newer = storage(JSON.stringify({...snapshot(), version: 2}));
  newer.readBackupSync = () => JSON.stringify(snapshot());
  const memory = new ScreenMemory(newer); await memory.refresh().then(memory.flush);
  expect(memory.getSnapshot().storageIssue).toBe('unsupported');
  expect(newer.write).not.toHaveBeenCalled();
});

it('can recover from a temporary read failure without saving defaults over existing data', async () => {
  const saved = snapshot(); saved.data.cards.find(card => card.id === 'draft-1')!.draft.title = '읽기 오류 뒤 복구';
  const disk = storage(JSON.stringify(saved)), read = disk.readSync;
  disk.readSync = () => {throw new Error('temporary');};
  const memory = new ScreenMemory(disk); await memory.flush();
  expect(disk.write).not.toHaveBeenCalled(); expect(memory.getSnapshot().storageIssue).toBe('read');
  disk.readSync = read; await memory.refresh().then(memory.flush);
  expect(memory.getSnapshot().saveError).toBe(false);
  expect(memory.getSnapshot().data.cards.find(card => card.id === 'draft-1')!.draft.title).toBe('읽기 오류 뒤 복구');
  expect(disk.write).not.toHaveBeenCalled();
});

it('waits for the edit queued in the final write microtask before flush resolves', async () => {
  const disk = storage(JSON.stringify(snapshot())), memory = new ScreenMemory(disk);
  const edit = (value: string) => memory.dispatchCard({type: 'edit', id: 'draft-1', field: 'title', value, now: 1});
  edit('first'); queueMicrotask(() => edit('last-microtask-change'));
  await memory.flush();
  expect(new ScreenMemory(disk).getSnapshot().data.cards.find(card => card.id === 'draft-1')!.draft.title).toBe('last-microtask-change');
  expect(memory.getSnapshot().saveError).toBe(false);
});

it.each(['empty', 'backup'])('retries an initial read failure and safely recovers a subsequently readable %s store', async kind => {
  const disk = storage(kind === 'empty' ? null : '{broken');
  const originalRead = disk.readSync;
  disk.readSync = () => {throw new Error('initialization failed');};
  const saved = snapshot(); saved.data.cards[0]!.draft.title = '복구한 초안';
  disk.readBackupSync = () => kind === 'backup' ? JSON.stringify(saved) : null;
  const memory = new ScreenMemory(disk);
  expect(memory.getSnapshot().storageIssue).toBe('read');
  expect(memory.getSnapshot().data.cards).toEqual([]);
  await memory.flush(); expect(disk.write).not.toHaveBeenCalled();
  disk.readSync = originalRead;
  await memory.refresh().then(memory.flush);
  expect(memory.getSnapshot().saveError).toBe(false);
  expect(memory.getSnapshot().data.cards.length).toBeGreaterThan(0);
  expect(decodeScreenSnapshot(disk.readSync())!.data).toEqual(memory.getSnapshot().data);
  if (kind === 'backup') expect(memory.getSnapshot().data.cards[0]!.draft.title).toBe('복구한 초안');
});

it('stores filter scroll positions independently and migrates only the selected legacy filter', async () => {
  const old = snapshot();
  old.view.libraryFilter = 'recent';
  old.positions.library = {offset: 210, hidden: 60, height: 120, maxOffset: 900};
  const disk = storage(JSON.stringify(old));
  const memory = new ScreenMemory(disk);
  expect(memory.getScroll('library:recent').offset).toBe(210);
  expect(memory.getScroll('library:all').offset).toBe(0);
  memory.rememberScroll('library:all', {offset: 500, hidden: 120, height: 120, maxOffset: 900});
  expect(memory.getScroll('library').offset).toBe(210);
  await memory.flush();
  const reopened = new ScreenMemory(disk);
  expect(reopened.getScroll('library:all').offset).toBe(500);
  expect(reopened.getScroll('library:recent').offset).toBe(210);
});

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
  disk.writeView = vi.fn(async value => {
    if (!persisted.length) await new Promise<void>(done => {unblock = done;});
    persisted.push(value);
  });
  const memory = new ScreenMemory(disk);
  memory.updateView(view => ({...view, tab: 'chats'}));
  await Promise.resolve();
  memory.updateView(view => ({...view, tab: 'settings'}));
  unblock(); await memory.flush();
  expect(disk.writeView).toHaveBeenCalledTimes(2);
  expect(JSON.parse(persisted.at(-1)!).view.tab).toBe('settings');
  expect(disk.write).not.toHaveBeenCalled();
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
  expect(disk.writeView).toHaveBeenCalledTimes(1);
  expect(disk.write).not.toHaveBeenCalled();
  expect(new ScreenMemory(disk).getScroll('library').offset).toBe(30);
});

it('restores detail state and scroll while accepting older snapshots and rejecting unpublished detail targets', async () => {
  const disk = storage();
  const memory = new ScreenMemory(disk);
  memory.updateView(view => ({...view, detailCardId: 'night-library'}));
  memory.rememberScroll('detail', {offset: 130, hidden: 0, height: 0, maxOffset: 260});
  await memory.flush();
  const reopened = new ScreenMemory(disk);
  expect(reopened.getSnapshot().view.detailCardId).toBe('night-library');
  expect(reopened.getScroll('detail').offset).toBe(130);
  const previous = snapshot();
  const {detailCardId: _detailCardId, ...oldView} = previous.view;
  expect(decodeScreenSnapshot(JSON.stringify({...previous, view: oldView}))?.view.detailCardId).toBeNull();
  expect(decodeScreenSnapshot(JSON.stringify({...previous, view: {...oldView, detailCardId: 'draft-1'}}))?.view.detailCardId).toBeNull();
  await reopened.refresh(async () => ({...reopened.getSnapshot().data,
    cards: reopened.getSnapshot().data.cards.filter(card => card.id !== 'night-library')}));
  expect(reopened.getSnapshot().view.detailCardId).toBeNull();
});

it('restores the image viewer only above a valid published detail and closes it if that card disappears', async () => {
  const saved = snapshot(); saved.view.detailCardId = 'night-library'; saved.view.coverOpen = true;
  const disk = storage(JSON.stringify(saved));
  const memory = new ScreenMemory(disk);
  expect(memory.getSnapshot().view.coverOpen).toBe(true);
  for (const detailCardId of [null, 'draft-1', 'missing']) {
    expect(decodeScreenSnapshot(JSON.stringify({...saved, view: {...saved.view, detailCardId}}))?.view.coverOpen).toBe(false);
  }
  expect(decodeScreenSnapshot(JSON.stringify({...saved, view: {...saved.view, openedCardId: 'draft-1'}}))?.view.coverOpen).toBe(false);
  await memory.refresh(async () => ({...saved.data, cards: saved.data.cards.filter(card => card.id !== 'night-library')}));
  expect(memory.getSnapshot().view.coverOpen).toBe(false);
  expect(memory.getSnapshot().view.detailCardId).toBeNull();
});
