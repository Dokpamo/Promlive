// @vitest-environment jsdom
import './ui-image-fixtures';
import {act, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {IDBFactory, IDBKeyRange} from 'fake-indexeddb';
import {afterEach, expect, it, vi} from 'vitest';
import App from '../App';
import {WorkspaceMemory} from '../src/ui/workspace/WorkspaceMemory';
import {IndexedWorkspace} from '../src/adapters/indexeddb/IndexedWorkspace';
import {initialScreenData, initialScreenView} from '../src/ui/screenState';
import {installBrowserScreenStorage} from './browser-screen-storage';

const viewport = vi.hoisted(() => ({width: 1280}));
vi.mock('../src/app/runtime', () => ({initialize: () => new Promise(() => {})}));
vi.mock('../src/adapters/screen/screenStorage', () => import('../src/adapters/screen/screenStorage.web'));
vi.mock('../src/ui/chat-input/InputField', () => import('../src/ui/chat-input/InputField.web'));
vi.mock('react-native', async () => {
  const native = await vi.importActual<typeof import('react-native')>('react-native-web');
  return {...native, AccessibilityInfo: {...native.AccessibilityInfo, isReduceMotionEnabled: async () => true},
    useWindowDimensions: () => ({width: viewport.width, height: 900, fontScale: 1, scale: 1})};
});
vi.mock('react-native-safe-area-context', () => ({SafeAreaProvider: ({children}: {children: ReactNode}) => <>{children}</>,
  useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0})}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined, memory: WorkspaceMemory | undefined, store: IndexedWorkspace | undefined;
afterEach(async () => {if (root) await act(async () => root!.unmount()); await memory?.flush(); await store?.close();
  document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals();});
const control = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement;
const settle = async () => {await act(async () => {await new Promise(resolve => setTimeout(resolve, 60));});};
const waitForControl = async (id: string) => {
  await vi.waitFor(async () => {await settle(); expect(control(id)).not.toBeNull();}, {timeout: 4000, interval: 10});
};

it.each([412, 1280])('uses indexed lists and persists drafts independently of long history at width %i', async width => {
  viewport.width = width;
  vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('IDBKeyRange', IDBKeyRange);
  installBrowserScreenStorage();
  const data = structuredClone(initialScreenData()), original = data.cards[0]!;
  data.cards = Array.from({length: 180}, (_, index) => ({...original, id: `card-${index}`, updatedAt: 1000 - index,
    draft: {...original.draft, title: `카드 ${index}`, introduction: '가'.repeat(10_000)},
    published: {...original.draft, title: `카드 ${index}`, introduction: '가'.repeat(10_000)}}));
  const chat = data.chats[0]!;
  chat.messages = Array.from({length: 200}, (_, index) => ({id: `message-${index}`, role: index % 2 ? 'assistant' : 'user', text: '나'.repeat(10_000), sentAt: index}));
  const raw = JSON.stringify({version: 1, savedAt: 1, data, view: initialScreenView(), positions: {}});
  store = new IndexedWorkspace('ui-workspace');
  const reads = vi.spyOn(store, 'messages'), cards = vi.spyOn(store, 'card');
  memory = new WorkspaceMemory({read: async () => raw, readSync: () => raw, readBackupSync: () => null,
    readViewSync: () => null, write: async () => {}, writeView: async () => {}}, store, {read: () => null, write: async () => {}});
  await memory.initialize();
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => {root!.render(<App memory={memory!}/>); await memory!.collection({scope: 'library', filter: 'all', search: ''}).load();}); await settle();
  const cardId = (id: string) => `${width < 800 ? 'ui-bot-card' : 'ui-card'}-${id}`;
  expect(control(cardId('card-0'))).not.toBeNull();
  expect(cards).not.toHaveBeenCalled(); expect(reads).not.toHaveBeenCalled();
  await act(async () => memory!.updateView(view => ({...view, searches: {...view.searches, library: {open: true, query: '카드 179'}}})));
  await waitForControl(cardId('card-179'));
  await act(async () => control(cardId('card-179')).click()); await waitForControl('ui-card-detail');
  expect(control('ui-card-detail').textContent).toContain('가'.repeat(10_000));
  expect(cards).toHaveBeenCalledWith('card-179');
  await act(async () => memory!.updateView(view => ({...view, tab: 'chats', detailCardId: null, chatId: chat.id})));
  await waitForControl('ui-chat-message-message-199');
  expect(control('ui-chat-message-message-199').textContent).toContain('나'.repeat(10_000));
  expect(memory.room(chat.id)!.snapshot().messages.length).toBeLessThan(5);
  const before = reads.mock.calls.length;
  const field = control('ui-chat-input') as HTMLTextAreaElement;
  await act(async () => {Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, '새 초안');
    field.dispatchEvent(new Event('input', {bubbles: true}));});
  await act(async () => memory!.flush());
  expect((await store.chat(chat.id))!.value.draft).toBe('새 초안');
  expect(reads.mock.calls.length).toBe(before);
});
