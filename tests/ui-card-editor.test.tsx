// @vitest-environment jsdom
import {inspectScreenSnapshot} from '../src/ui/screenState';
import './ui-image-fixtures';
import {act, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import App from '../App';
import {ScreenMemory} from '../src/ui/ScreenMemory';
import {createScreenStorage} from '../src/adapters/screen/screenStorage.web';
import {screenStorageKey} from '../src/ports/screenStorage';
import {decodeScreenSnapshot} from '../src/ui/screenState';
import {createSettingsServices} from '../src/app/settingsServices';
import {installBrowserScreenStorage} from './browser-screen-storage';

const viewport = vi.hoisted(() => ({width: 1280, height: 800, fontScale: 1, scale: 1}));
vi.mock('../src/adapters/screen/screenStorage', () => import('../src/adapters/screen/screenStorage.web'));
vi.mock('../src/ui/chat-input/InputField', () => import('../src/ui/chat-input/InputField.web'));
vi.mock('react-native', async () => {
  const native = await vi.importActual<typeof import('react-native')>('react-native-web');
  return {...native, AccessibilityInfo: {...native.AccessibilityInfo, isReduceMotionEnabled: async () => true}, useWindowDimensions: () => viewport};
});
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({children}: {children: ReactNode}) => <>{children}</>,
  useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
beforeEach(installBrowserScreenStorage);
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined; document.body.replaceChildren(); vi.restoreAllMocks();
});
const field = (name: string) => [...document.querySelectorAll(`[data-testid="ui-card-editor-${name}"]`)]
  .find(el => !el.closest('[aria-hidden="true"]')) as HTMLInputElement;
async function typeTags(value: string, selection = value.length) {
  await act(async () => {
    const input = field('tags');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.setSelectionRange(selection, selection);
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
}
async function fixture() {
  const memory = new ScreenMemory(createScreenStorage(inspectScreenSnapshot));
  memory.dispatchCard({type: 'edit', id: 'draft-1', field: 'tags', value: 'old-tag', now: 1});
  memory.updateView(view => ({...view, tab: 'create', openedCardId: 'draft-1'}));
  await memory.flush();
  const values = new Map<string, string>();
  const services = createSettingsServices({getSetting: async key => values.get(key), setSetting: async (key, value) => {values.set(key, value);}},
    {get: async () => null, set: async () => {}, remove: async () => {}});
  await services.load();
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<App memory={memory} settingsServices={services}/>));
  return memory;
}
async function storageChanged(memory: ScreenMemory) {
  await act(async () => {
    window.dispatchEvent(new StorageEvent('storage', {key: screenStorageKey}));
    await memory.refresh(); await memory.flush();
  });
}
const savedTags = () => decodeScreenSnapshot(window.localStorage.getItem(screenStorageKey))!.data.cards.find(card => card.id === 'draft-1')!.draft.tags;

describe.each([412, 1280])('card editor at width %i', width => {
  beforeEach(() => {viewport.width = width;});
  it('updates the mounted field after an external refresh and appends to the latest tags', async () => {
    const memory = await fixture(), input = field('tags');
    const remote = new ScreenMemory(createScreenStorage(inspectScreenSnapshot));
    remote.dispatchCard({type: 'edit', id: 'draft-1', field: 'tags', value: 'remote-tag', now: 2});
    remote.dispatchCard({type: 'edit', id: 'draft-1', field: 'title', value: 'Remote title', now: 3});
    await remote.flush(); await storageChanged(memory);
    expect(field('title').value).toBe('Remote title');
    expect(field('tags')).toBe(input);
    expect(input.value).toBe('remote-tag');
    await typeTags(input.value + ', local-tag');
    await act(async () => {await memory.flush();});
    expect(savedTags()).toEqual(['remote-tag', 'local-tag']);
    expect(memory.getSnapshot().storageIssue).toBeNull();
  });
  it('preserves raw typing and the caret across local saves and unrelated external changes', async () => {
    const memory = await fixture(), input = field('tags');
    await act(async () => input.focus());
    const raw = '  old-tag,  새 태그, ';
    await typeTags(raw, 6); await act(async () => {await memory.flush();});
    expect(input.value).toBe(raw); expect(input.selectionStart).toBe(6);
    const remote = new ScreenMemory(createScreenStorage(inspectScreenSnapshot));
    remote.dispatchCard({type: 'edit', id: 'draft-1', field: 'title', value: '제목만 변경', now: 4});
    await remote.flush(); await storageChanged(memory);
    expect(field('tags')).toBe(input); expect(input.value).toBe(raw);
    expect(document.activeElement).toBe(input); expect(input.selectionStart).toBe(6);
    expect(savedTags()).toEqual(['old-tag', '새 태그']);
    await typeTags('  old-tag,  새 태그, 다음, ');
    expect(input.value).toBe('  old-tag,  새 태그, 다음, ');
    expect(savedTags()).toEqual(['old-tag', '새 태그', '다음']);
  });
  it('preserves both a conflicting local edit and the other instance’s saved tags', async () => {
    const memory = await fixture(), remote = new ScreenMemory(createScreenStorage(inspectScreenSnapshot));
    remote.dispatchCard({type: 'edit', id: 'draft-1', field: 'tags', value: 'remote-tag', now: 5});
    await remote.flush();
    await typeTags('old-tag, local-tag, '); await storageChanged(memory);
    expect(memory.getSnapshot().storageIssue).toBe('conflict');
    expect(field('tags').value).toBe('old-tag, local-tag, ');
    expect(savedTags()).toEqual(['remote-tag']);
    expect(memory.getSnapshot().data.cards.find(card => card.id === 'draft-1')!.draft.tags).toEqual(['old-tag', 'local-tag']);
  });
});
