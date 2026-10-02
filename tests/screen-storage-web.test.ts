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
