// @vitest-environment jsdom
import {act, useState, useSyncExternalStore, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {CardConversationPanel} from '../src/features/chat/CardConversationPanel';
import {DrawerModalLocks} from '../src/features/chat/DrawerGestureBoundary';
import {repository, FixtureProvider} from './helpers';
import {newCard, type Card} from '../src/features/cards/model';
import {Workspace} from '../src/app/workspace';
import {CreationService} from '../src/features/chat/service';
import {GenerationCoordinator} from '../src/features/chat/generation';
import type {Repository} from '../src/adapters/sqlite/repository';
import type {HistoryLayoutItem} from '../src/features/chat/historyListMotion';

vi.mock('react-native', async () => {
  const React = await import('react');
  const native = await vi.importActual<typeof import('react-native')>('react-native-web');
  const View = React.forwardRef(({children, testID, onLayout}: {children?: ReactNode; testID?: string; onLayout?: (event: unknown) => void}, ref) => {
    React.useImperativeHandle(ref, () => ({measureInWindow: (done: (...values: number[]) => void) => done(0, 200, 320, 48)}));
    const layout = React.useRef(onLayout); layout.current = onLayout;
    React.useEffect(() => {layout.current?.({nativeEvent: {layout: {width: 320, height: 650}}});}, []);
    return <div data-testid={testID}>{children}</div>;
  });
  const animate = (value: {setValue: (next: number) => void}, config: {toValue: number}) => ({start: (done?: (result: {finished: boolean}) => void) => {value.setValue(config.toValue); done?.({finished: true});}, stop() {}});
  return {...native, View, Text: ({children}: {children: ReactNode}) => <span>{children}</span>,
    AccessibilityInfo: {isReduceMotionEnabled: async () => false, addEventListener: () => ({remove() {}})},
    Animated: {...native.Animated, View, timing: animate, spring: animate},
    FlatList: ({data, renderItem, ListFooterComponent}: {data: HistoryLayoutItem[]; renderItem: (args: {item: HistoryLayoutItem; index: number}) => ReactNode; ListFooterComponent: ReactNode}) => <div data-testid="history-rows">{data.map((item, index) => <div key={item.key}>{renderItem({item, index})}</div>)}{ListFooterComponent}</div>,
  };
});
vi.mock('react-native-safe-area-context', () => ({useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0})}));
vi.mock('../src/layout/FrostedEdge', () => ({FrostedEdge: ({children}: {children: ReactNode}) => children}));
vi.mock('../src/features/chat/ChatHistory', () => ({
  CardConversationHeader: ({onClose}: {onClose: () => void}) => <button onClick={onClose}>닫기</button>,
}));
vi.mock('../src/layout/RowPressable', () => ({RowPressable: ({children, onPress, onLongPress, accessibilityLabel, accessibilityState}: {children: ReactNode; onPress: () => void; onLongPress?: () => void; accessibilityLabel: string; accessibilityState?: {checked?: boolean}}) => <button aria-label={accessibilityLabel} aria-checked={accessibilityState?.checked} onClick={onPress} onContextMenu={event => {event.preventDefault(); onLongPress?.();}}>{children}</button>}));
vi.mock('../src/layout/PressSurface', () => ({PressSurface: ({children, onPress, disabled, accessibilityLabel}: {children: ReactNode; onPress: () => void; disabled: boolean; accessibilityLabel: string}) => <button aria-label={accessibilityLabel} disabled={disabled} onClick={onPress}>{children}</button>}));
vi.mock('../src/features/settings/SettingsIcon', () => ({SettingsIcon: () => null}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let repo: Repository;
const locks = {current: 0};
const close = vi.fn();
function Host({workspace, card}: {workspace: Workspace; card: Card}) {
  useSyncExternalStore(workspace.subscribe, workspace.snapshot);
  const [search, setSearch] = useState('');
  return <DrawerModalLocks.Provider value={locks}>
    <input aria-label="검색" value={search} onChange={event => setSearch(event.target.value)}/>
    <CardConversationPanel history={workspace.history} openConversation={item => workspace.openConversation(item)} report={workspace.notifications.report} card={card} scale={0.6} search={search} close={close} onClose={close} scroll={{current: {offset: 0, canScroll: true}}} onListTouch={() => {}}/>
  </DrawerModalLocks.Provider>;
}
afterEach(async () => {if (root) await act(async () => root!.unmount()); root = undefined; if (repo) await repo.db.close(); document.body.replaceChildren(); close.mockClear();});
function button(label: string) {return document.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement;}
async function press(label: string) {await act(async () => button(label).click());}
async function search(value: string) {
  await act(async () => {
    const input = document.querySelector('input')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
}
it('long press opens actions without navigating; selection survives filtering and deletes exactly the chosen rooms', async () => {
  repo = await repository();
  const card = await repo.insertCard(newCard());
  const first = await repo.createConversation(card.id, '첫 번째');
  const second = await repo.createConversation(card.id, '두 번째');
  const keep = await repo.createConversation(card.id, '유지');
  const provider = new FixtureProvider();
  const workspace = new Workspace({repo, provider, creation: new CreationService(repo, new GenerationCoordinator(provider))});
  await workspace.ready(); await workspace.openConversation(keep);
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<Host workspace={workspace} card={card}/>));
  await act(async () => {button('첫 번째 채팅 열기').dispatchEvent(new MouseEvent('contextmenu', {bubbles: true}));});
  expect(locks.current).toBe(1);
  expect(close).not.toHaveBeenCalled();
  expect(workspace.history.selected?.id).toBe(keep.id);
  for (const label of ['선택', '고정', '이름 변경', '삭제']) expect(button(label)).not.toBeNull();
  await press('선택');
  expect(locks.current).toBe(0);
  expect(button('첫 번째').getAttribute('aria-checked')).toBe('true');
  await search('두 번째'); await press('두 번째');
  expect(button('선택한 채팅 2개 삭제')).not.toBeNull();
  expect(document.querySelector('[data-testid="history-selection-footer"]')).not.toBeNull();
  await press('선택한 채팅 2개 삭제');
  expect((await repo.conversations()).map(item => item.id)).toEqual([keep.id]);
  expect(await repo.messages(first.id)).toEqual([]);
  expect(await repo.messages(second.id)).toEqual([]);
  expect(workspace.history.selected?.id).toBe(keep.id);
});

it('leaves selection mode when the last item is unchecked, but not when filtering hides it', async () => {
  repo = await repository();
  const card = await repo.insertCard(newCard());
  const first = await repo.createConversation(card.id, '첫 번째');
  const second = await repo.createConversation(card.id, '두 번째');
  const provider = new FixtureProvider();
  const workspace = new Workspace({repo, provider, creation: new CreationService(repo, new GenerationCoordinator(provider))});
  await workspace.ready(); await workspace.openConversation(second);
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<Host workspace={workspace} card={card}/>));
  await act(async () => {button('첫 번째 채팅 열기').dispatchEvent(new MouseEvent('contextmenu', {bubbles: true}));});
  await press('선택');
  await search('검색 결과 없음');
  expect(button('선택한 채팅 1개 삭제')).not.toBeNull();
  await search('');
  await press('첫 번째');
  expect(document.querySelector('[aria-checked]')).toBeNull();
  expect(document.querySelector('[aria-label^="선택한 채팅"]')).toBeNull();
  expect(document.querySelector('[data-testid="history-selection-footer"]')).toBeNull();
  expect(close).not.toHaveBeenCalled();
  await press('첫 번째 채팅 열기');
  expect(workspace.history.selected?.id).toBe(first.id);
  expect(close).toHaveBeenCalledOnce();
});

it('places the action menu outside the history panel and dismisses it without activating the page beneath', async () => {
  repo = await repository();
  const card = await repo.insertCard(newCard());
  const conversation = await repo.createConversation(card.id, '유지할 채팅');
  const provider = new FixtureProvider();
  const workspace = new Workspace({repo, provider, creation: new CreationService(repo, new GenerationCoordinator(provider))});
  await workspace.ready(); await workspace.openConversation(conversation);
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<Host workspace={workspace} card={card}/>));
  await act(async () => {button('유지할 채팅 채팅 열기').dispatchEvent(new MouseEvent('contextmenu', {bubbles: true}));});
  const menu = document.querySelector('[data-testid="history-actions-overlay"]');
  expect(menu).not.toBeNull();
  expect(document.querySelector('[data-testid="history-content"]')!.contains(menu)).toBe(false);
  await press('채팅내역 메뉴 닫기');
  expect(document.querySelector('[data-testid="history-actions-overlay"]')).toBeNull();
  expect(locks.current).toBe(0);
  expect(close).not.toHaveBeenCalled();
  expect(workspace.history.selected?.id).toBe(conversation.id);
  expect((await repo.conversations()).map(item => item.id)).toEqual([conversation.id]);
});
