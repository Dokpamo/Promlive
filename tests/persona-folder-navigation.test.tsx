// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {usePersonaFolderNavigation} from '../src/features/personas/usePersonaFolderNavigation';
import type {PersonaCollection} from '../src/features/personas/personaPreferences';

const motion = vi.hoisted(() => {
  class Value {
    displayed: number;
    listeners = new Map<string, (event: {value: number}) => void>();
    constructor(value: number) {this.displayed = value;}
    setValue(value: number) {this.displayed = value; this.listeners.forEach(listener => listener({value}));}
    addListener(listener: (event: {value: number}) => void) {const id = String(this.listeners.size); this.listeners.set(id, listener); return id;}
    removeListener(id: string) {this.listeners.delete(id);}
    stopAnimation(done?: (value: number) => void) {done?.(this.displayed);}
    interpolate() {return {};}
  }
  return {Value, springs: [] as {value: Value; target: number; finish: () => void}[]};
});
vi.mock('react-native', () => ({
  Platform: {OS: 'android'},
  Animated: {Value: motion.Value, spring: (value: InstanceType<typeof motion.Value>, options: {toValue: number}) => ({
    start: (done: (result: {finished: boolean}) => void) => motion.springs.push({value, target: options.toValue, finish: () => done({finished: true})}),
  })},
}));
vi.mock('../src/layout/itemListMotion', () => ({useItemReducedMotion: () => false}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

const value: PersonaCollection = {selectedId: null, items: [], folders: [
  {id: 'outer', name: '보관', parentId: null},
  {id: 'inner', name: '작업', parentId: 'outer'},
  {id: 'sibling', name: '다른 폴더', parentId: null},
]};
let root: Root | undefined;
let navigation!: ReturnType<typeof usePersonaFolderNavigation>;
async function render(initialFolderId: string | null = null, blocked = false, data = value) {
  function Host() {
    navigation = usePersonaFolderNavigation({value: data, initialFolderId, blocked, width: 400, canVisit: () => true});
    return null;
  }
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<Host/>));
}
afterEach(async () => {if (root) await act(async () => root!.unmount()); root = undefined; motion.springs.length = 0; document.body.replaceChildren();});
async function finish() {await act(async () => motion.springs.at(-1)!.finish());}
async function swipe(dx: number, cancelled = false) {
  await act(async () => {navigation.drag.begin(Math.sign(dx) * 12, 0); navigation.drag.move(dx - Math.sign(dx) * 12, 0); navigation.drag.release(dx - Math.sign(dx) * 12, 0, 0, 0, cancelled);});
}

it('enters from the right and reverses the same moving page immediately without waiting for its spring', async () => {
  await render();
  await act(async () => navigation.navigate('outer'));
  expect(navigation.transition).toEqual({from: null, to: 'outer', direction: 1});
  const old = motion.springs.at(-1)!;
  old.value.displayed = 0.65; // Native animation can be ahead of the JS listener.
  await act(async () => {navigation.drag.begin(12, 0); navigation.drag.move(128, 0);});
  expect(old.value.displayed).toBeCloseTo(0.3);
  await act(async () => navigation.drag.release(128, 0, 0.7, 0, false));
  expect(navigation.folderId).toBeNull();
  expect(motion.springs.at(-1)!.target).toBe(0);
  await act(async () => old.finish());
  expect(navigation.transition).not.toBeNull(); // Old completion cannot remove the reversing page.
  await finish();
  expect(navigation.transition).toBeNull();
});

it('swipes back through ancestors and forward along the same visited path, never into an arbitrary sibling', async () => {
  await render('inner');
  await swipe(150); expect(navigation.folderId).toBe('outer'); await finish();
  await swipe(150); expect(navigation.folderId).toBeNull(); await finish();
  await swipe(-150); expect(navigation.folderId).toBe('outer'); await finish();
  await swipe(-150); expect(navigation.folderId).toBe('inner'); await finish();
  const count = motion.springs.length;
  await swipe(-150);
  expect(navigation.folderId).toBe('inner'); expect(motion.springs).toHaveLength(count);
});

it('returns a short or cancelled pull to the same folder and preserves forward navigation', async () => {
  await render('inner');
  await swipe(50); expect(navigation.folderId).toBe('inner'); await finish();
  await swipe(200, true); expect(navigation.folderId).toBe('inner'); await finish();
  await swipe(150); expect(navigation.folderId).toBe('outer'); await finish();
  await swipe(-150); expect(navigation.folderId).toBe('inner');
});

it('keeps forward history when using breadcrumbs but replaces it when entering a different branch', async () => {
  await render('inner');
  await act(async () => navigation.navigate(null)); await finish();
  await swipe(-150); expect(navigation.folderId).toBe('outer'); await finish();
  await act(async () => navigation.navigate(null)); await finish();
  await act(async () => navigation.navigate('sibling')); await finish();
  await swipe(-150); expect(navigation.folderId).toBe('sibling');
});

it('consumes back without changing the picker while a name editor or save blocks it', async () => {
  await render('inner', true);
  expect(navigation.drag.canStart()).toBe(false);
  await act(async () => {navigation.navigate(null); expect(navigation.back()).toBe(true);});
  await swipe(150);
  expect(navigation.folderId).toBe('inner'); expect(motion.springs).toEqual([]);
});

it('keeps an unvisited root swipe in the picker and lets a root back request close it normally', async () => {
  await render();
  await swipe(200); await swipe(-200);
  expect(navigation.folderId).toBeNull(); expect(motion.springs).toEqual([]);
  expect(navigation.back()).toBe(false);
});
