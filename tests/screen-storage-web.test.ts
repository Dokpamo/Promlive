// @vitest-environment jsdom
import {beforeEach, expect, it, vi} from 'vitest';
import {createScreenStorage} from '../src/ui/screenStorage.web';
import {ScreenMemory} from '../src/ui/ScreenMemory';
import {initialScreenData, initialScreenView, decodeScreenSnapshot} from '../src/ui/screenState';
import {screenStorageKey, screenViewKey, ScreenStorageConflict} from '../src/ui/screenPersistence';
import {browserStore, installBrowserScreenStorage} from './browser-screen-storage';

beforeEach(installBrowserScreenStorage);
const snapshot = (title: string) => {
  const data = initialScreenData(); data.cards = data.cards.map((card, index) => index === 0 ? {...card, draft: {...card.draft, title}} : card);
  return JSON.stringify({version: 1, savedAt: 1, data, view: initialScreenView(), positions: {}});
};
it.each(['localStorage', 'sessionStorage'] as const)('preserves legacy view and drafts across repeated reloads when %s rejects migration', async failingStore => {
  const saved = JSON.parse(snapshot('구형 저장본'));
  saved.view = {...initialScreenView(), tab: 'chats', chatId: 'night-library',
    searches: {...initialScreenView().searches, chats: {open: true, query: '저장된 검색'}}};
  saved.positions = {'chat:night-library': {offset: 240, hidden: 0, height: 50, maxOffset: 800}};
  window.localStorage.setItem(screenStorageKey, JSON.stringify(saved));
  const store = window[failingStore], set = store.setItem;
  const failure = vi.spyOn(store, 'setItem').mockImplementation((key, value) => {
    if (key === screenViewKey) throw new Error('view quota'); set(key, value);
  });
  const first = new ScreenMemory(createScreenStorage());
  first.updateChatDraft('night-library', '첫 수정'); await first.flush();
  expect(first.getSnapshot().storageIssue).toBe('write');
  // Reload the same tab and edit again before ending the browser session.
  const reloaded = new ScreenMemory(createScreenStorage());
  reloaded.updateChatDraft('night-library', '두 번째 수정'); await reloaded.flush();
  failure.mockRestore();
  Object.defineProperty(window, 'sessionStorage', {configurable: true, value: browserStore()});
  const reopened = new ScreenMemory(createScreenStorage());
  expect(reopened.getSnapshot().view).toEqual(saved.view);
  expect(reopened.getScroll('chat:night-library').offset).toBe(240);
  expect(reopened.getSnapshot().data.chats.find(chat => chat.id === 'night-library')!.draft).toBe('두 번째 수정');
  await reopened.flush();
  expect(window.localStorage.getItem(screenViewKey)).not.toBeNull();
  expect(reopened.getSnapshot().saveError).toBe(false);
});

it('preserves a good recovery backup when repairing the primary fails for quota', async () => {
  const good = snapshot('유일한 정상본');
  window.localStorage.setItem(screenStorageKey, '{broken'); window.localStorage.setItem(screenStorageKey + ':backup', good);
  const storage = createScreenStorage(), memory = new ScreenMemory(storage), set = window.localStorage.setItem;
  vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {if (key === screenStorageKey) throw new Error('quota'); set(key, value);});
  await memory.refresh().then(memory.flush);
  expect(memory.getSnapshot().saveError).toBe(true);
  expect(storage.readSync()).toBe('{broken'); expect(storage.readBackupSync()).toBe(good);
  expect(new ScreenMemory(storage).getSnapshot().data.cards[0]!.draft.title).toBe('유일한 정상본');
});
it.each(['backup', 'primary'])('retains a valid copy when the %s write fails', async failure => {
  const previous = snapshot('저장된 원본'); window.localStorage.setItem(screenStorageKey, previous);
  const storage = createScreenStorage(), set = window.localStorage.setItem;
  vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === screenStorageKey + (failure === 'backup' ? ':backup' : '')) throw new Error('quota'); set(key, value);
  });
  await expect(storage.write(snapshot('새 초안'), previous)).rejects.toThrow('quota');
  expect(decodeScreenSnapshot(storage.readSync())!.data.cards[0]!.draft.title).toBe('저장된 원본');
});
it('serializes two writers and rejects a stale content snapshot inside the lock', async () => {
  const previous = snapshot('처음'); window.localStorage.setItem(screenStorageKey, previous);
  const a = createScreenStorage(), b = createScreenStorage(), first = snapshot('A');
  const results = await Promise.allSettled([a.write(first, previous), b.write(snapshot('B'), previous)]);
  expect(results[0]!.status).toBe('fulfilled');
  expect(results[1]).toMatchObject({status: 'rejected', reason: expect.any(ScreenStorageConflict)});
  expect(a.readSync()).toBe(first);
});
it('keeps presentation in per-tab storage without changing shared content', async () => {
  const content = snapshot('공유'); window.localStorage.setItem(screenStorageKey, content);
  const a = createScreenStorage(); await a.writeView(JSON.stringify({tab: 'settings'}));
  const tabA = window.sessionStorage;
  Object.defineProperty(window, 'sessionStorage', {configurable: true, value: browserStore()});
  const b = createScreenStorage(); expect(b.readViewSync()).toContain('settings');
  await b.writeView(JSON.stringify({tab: 'create'}));
  expect(tabA.getItem(screenViewKey)).toContain('settings');
  expect(b.readViewSync()).toContain('create'); expect(b.readSync()).toBe(content);
  // Closing all tabs must not lose the most recently viewed screen.
  Object.defineProperty(window, 'sessionStorage', {configurable: true, value: browserStore()});
  expect(createScreenStorage().readViewSync()).toContain('create');
});
it('does not perform an unsafe write when the browser has no cross-tab lock support', async () => {
  Object.defineProperty(navigator, 'locks', {configurable: true, value: undefined});
  const storage = createScreenStorage();
  await expect(storage.write(snapshot('새 값'), null)).rejects.toThrow('Web Locks');
  expect(storage.readSync()).toBeNull();
});
