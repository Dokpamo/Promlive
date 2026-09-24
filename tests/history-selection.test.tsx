// @vitest-environment jsdom
import {act, useEffect, useState, useSyncExternalStore, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {CardList} from '../src/features/cards/CardList';
import {CardConversationPanel} from '../src/features/chat/CardConversationPanel';
import {DrawerModalLocks} from '../src/features/chat/DrawerGestureBoundary';
import {repository, FixtureProvider} from './helpers';
import {newCard, type Card} from '../src/features/cards/model';
import {Workspace} from '../src/app/workspace';
import {CreationService} from '../src/features/chat/service';
import {GenerationCoordinator} from '../src/features/chat/generation';
import type {Repository} from '../src/adapters/sqlite/repository';
import type {ItemLayout, ListItem} from '../src/layout/itemListMotion';

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
    FlatList: ({data, renderItem, ListFooterComponent, ListHeaderComponent}: {ListHeaderComponent?: ReactNode; data: ItemLayout<ListItem>[]; renderItem: (args: {item: ItemLayout<ListItem>; index: number}) => ReactNode; ListFooterComponent: ReactNode}) => <div data-testid="history-rows">{ListHeaderComponent}{data.map((item, index) => <div key={item.key}>{renderItem({item, index})}</div>)}{ListFooterComponent}</div>,
  };
});
vi.mock('react-native-safe-area-context', () => ({SafeAreaProvider: ({children}: {children: ReactNode}) => children, useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0})}));
vi.mock('../src/layout/EdgeTint', () => ({EdgeTint: ({children}: {children: ReactNode}) => children}));
vi.mock('../src/features/chat/ChatHistory', () => ({
  CardConversationHeader: ({onClose}: {onClose: () => void}) => <button onClick={onClose}>닫기</button>,
}));
vi.mock('../src/layout/RowPressable', () => ({RowPressable: ({children, onPress, onLongPress, accessibilityLabel, accessibilityState}: {children: ReactNode; onPress: () => void; onLongPress?: () => void; accessibilityLabel: string; accessibilityState?: {checked?: boolean}}) => <button aria-label={accessibilityLabel} aria-checked={accessibilityState?.checked} onClick={onPress} onContextMenu={event => {event.preventDefault(); onLongPress?.();}}>{children}</button>}));
vi.mock('../src/layout/PressSurface', () => ({PressSurface: ({children, onPress, disabled, accessibilityLabel}: {children: ReactNode; onPress: () => void; disabled: boolean; accessibilityLabel: string}) => <button aria-label={accessibilityLabel} disabled={disabled} onClick={onPress}>{children}</button>}));
vi.mock('../src/features/settings/SettingsLayout', () => ({
  useSettingsScale: () => 0.6,
  SettingsSheet: ({children, footer, onClose, overlay, obscured, dismiss}: {children: (close: () => void) => ReactNode; footer?: (close: () => void) => ReactNode; onClose: () => void; overlay?: ReactNode; obscured?: boolean; dismiss?: boolean}) => {
    useEffect(() => {if (dismiss) onClose();}, [dismiss]);
    return <div><fieldset disabled={obscured}><button aria-label="폴더 선택 취소" onClick={onClose}/>{children(onClose)}{footer?.(onClose)}</fieldset>{overlay}</div>;
  },
}));
vi.mock('../src/features/cards/CardThumbnail', () => ({CardThumbnail: () => null}));
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
  expect(document.querySelector('[data-testid="history-selection-footer"]')!.contains(button('선택 취소'))).toBe(true);
  await press('선택 취소');
  expect(close).not.toHaveBeenCalled();
  expect(document.querySelector('[aria-checked]')).toBeNull();
  await hold('첫 번째 채팅 열기'); await press('선택');
  await search('두 번째'); await press('두 번째');
  expect(button('선택한 항목 삭제')).not.toBeNull();
  expect(document.querySelector('[data-testid="history-selection-footer"]')).not.toBeNull();
  await press('선택한 항목 삭제');
  expect((await repo.conversations())).toHaveLength(3);
  await press('삭제 확인');
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
  expect(button('선택한 항목 삭제')).not.toBeNull();
  await search('');
  await press('첫 번째');
  expect(document.querySelector('[aria-checked]')).toBeNull();
  expect(document.querySelector('[aria-label="선택한 항목 삭제"]')).toBeNull();
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

function CardHost({workspace}: {workspace: Workspace}) {
  useSyncExternalStore(workspace.subscribe, workspace.snapshot);
  const [query, setQuery] = useState('');
  return <DrawerModalLocks.Provider value={locks}>
    <input aria-label="검색" value={query} onChange={event => setQuery(event.target.value)}/>
    <CardList cards={workspace.cards.filter(card => card.title.includes(query))} allCards={workspace.cards} actions={workspace.cardActions}
      scale={0.6} search={query} active openCard={close} report={workspace.notifications.report}/>
  </DrawerModalLocks.Provider>;
}
async function cardHost() {
  repo = await repository();
  const cards = await Promise.all(['첫 카드', '둘째 카드', '유지 카드'].map((title, index) => repo.insertCard({...newCard(), title, updatedAt: 100 - index})));
  for (const card of cards) await repo.createConversation(card.id, `${card.title} 대화`);
  const provider = new FixtureProvider();
  const workspace = new Workspace({repo, provider, creation: new CreationService(repo, new GenerationCoordinator(provider))});
  await workspace.ready();
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<CardHost workspace={workspace}/>));
  return {workspace, cards};
}
async function holdCard(title: string) {
  await act(async () => {button(`${title} 카드의 채팅 기록`).dispatchEvent(new MouseEvent('contextmenu', {bubbles: true}));});
}
it('uses the same actions for cards, retains hidden selections and deletes only selected card histories', async () => {
  const {cards, workspace} = await cardHost();
  await holdCard('첫 카드');
  expect(locks.current).toBe(1);
  expect(close).not.toHaveBeenCalled();
  for (const label of ['선택', '고정', '이름 변경', '삭제']) expect(button(label)).not.toBeNull();
  await press('선택');
  expect(button('첫 카드').getAttribute('aria-checked')).toBe('true');
  await search('둘째'); await press('둘째 카드');
  expect(button('선택한 항목 삭제')).not.toBeNull();
  await press('선택한 항목 삭제');
  expect(workspace.cards).toHaveLength(3);
  await press('삭제 확인');
  expect(workspace.cards.map(card => card.id)).toEqual([cards[2]!.id]);
  expect((await repo.conversations()).map(room => room.cardId)).toEqual([cards[2]!.id]);
  expect(document.querySelector('[data-testid="card-selection-footer"]')).toBeNull();
});
it('pins cards above the others, unpins back to recency and dismisses outside taps without opening a card', async () => {
  const {cards, workspace} = await cardHost();
  await holdCard('유지 카드'); await press('고정');
  expect(workspace.cards[0]?.id).toBe(cards[2]!.id);
  expect(document.querySelector('[data-testid="card-pin-divider"]')).not.toBeNull();
  await holdCard('유지 카드'); expect(button('고정 해제')).not.toBeNull(); await press('고정 해제');
  expect(workspace.cards.map(card => card.id)).toEqual(cards.map(card => card.id));
  await holdCard('첫 카드'); await press('카드 메뉴 닫기');
  expect(locks.current).toBe(0);
  expect(document.querySelector('[data-testid="card-actions-overlay"]')).toBeNull();
  expect(close).not.toHaveBeenCalled();
});
it('exits card selection when the last check is cleared and when the cancel button is pressed', async () => {
  await cardHost();
  await holdCard('첫 카드'); await press('선택'); await press('첫 카드');
  expect(document.querySelector('[data-testid="card-selection-footer"]')).toBeNull();
  await holdCard('둘째 카드'); await press('선택');
  expect(document.querySelector('[data-testid="card-selection-footer"]')!.contains(button('선택 취소'))).toBe(true);
  expect(button('카드 선택 취소')).toBeNull();
  await press('선택 취소');
  expect(document.querySelector('[aria-checked]')).toBeNull();
  await press('첫 카드 카드의 채팅 기록');
  expect(close).toHaveBeenCalledOnce();
});
it('opens the compact editor for a card and applies the confirmed name to that card only', async () => {
  const {cards, workspace} = await cardHost();
  const oldRooms = await repo.conversations();
  await holdCard('둘째 카드'); await press('이름 변경');
  expect(document.querySelector('[data-testid="card-rename"]')).not.toBeNull();
  const input = document.querySelector('[data-testid="card-rename-input"]') as HTMLInputElement;
  expect(input.getAttribute('aria-label')).toBe('카드 이름');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '바뀐 카드');
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
  await press('이름 변경 완료');
  expect(workspace.cards.find(card => card.id === cards[1]!.id)?.title).toBe('바뀐 카드');
  expect((await repo.conversations()).map(room => room.title)).toEqual(oldRooms.map(room => room.title));
  expect(close).not.toHaveBeenCalled();
});

async function hold(label: string) {await act(async () => {button(label).dispatchEvent(new MouseEvent('contextmenu', {bubbles: true}));});}
async function input(label: string, value: string) {
  await act(async () => {
    const field = document.querySelector(`input[aria-label="${label}"]`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', {bubbles: true}));
  });
}
it('shows icon actions without visible labels or a selection count, clears on blank space and cancels deletion without changing data', async () => {
  const {workspace} = await cardHost();
  await holdCard('첫 카드'); await press('선택');
  expect(button('선택한 항목 폴더 이동').textContent).toBe('');
  expect(button('선택한 항목 삭제').textContent).toBe('');
  expect(document.body.textContent).not.toContain('개 선택');
  await press('빈 공간 눌러 선택 해제');
  expect(document.querySelector('[aria-checked]')).toBeNull();
  await holdCard('첫 카드'); await press('삭제');
  expect(workspace.cards).toHaveLength(3);
  await press('삭제 취소');
  expect(workspace.cards).toHaveLength(3);
  expect(document.querySelector('[data-testid="card-selection-footer"]')).toBeNull();
});
it('creates the first card folder directly, keeps nested cards searchable and opens the same card from its folder', async () => {
  const {workspace, cards} = await cardHost();
  await holdCard('첫 카드'); await press('선택'); await press('선택한 항목 폴더 이동');
  expect((document.querySelector('input[aria-label="폴더 이름"]') as HTMLInputElement).value).toBe('새폴더 1');
  await press('새 폴더 완료');
  expect(button('첫 카드 카드의 채팅 기록')).toBeNull();
  expect(button('새폴더 1 폴더')).not.toBeNull();
  expect(document.querySelector('[data-testid="card-selection-footer"]')).toBeNull();
  const saved = await repo.folderStore.read({kind: 'card'});
  expect(saved.items.find(item => item.id === cards[0]!.id)?.folderId).toBe(saved.folders[0]?.id);
  await search('첫 카드'); expect(button('첫 카드 카드의 채팅 기록')).not.toBeNull();
  await search(''); await press('새폴더 1 폴더');
  expect(button('상위 폴더, 카드')).not.toBeNull();
  expect(button('둘째 카드 카드의 채팅 기록')).toBeNull();
  await press('첫 카드 카드의 채팅 기록'); expect(close).toHaveBeenCalledWith(workspace.cards.find(card => card.id === cards[0]!.id));
  await press('상위 폴더, 카드'); expect(button('둘째 카드 카드의 채팅 기록')).not.toBeNull();
});
it('browses nested card destinations and keeps the picker in place while cancelling a new folder name', async () => {
  const {workspace, cards} = await cardHost();
  let parent!: {id: string}, child!: {id: string};
  await act(async () => {
    parent = await workspace.cardFolders.createFolder('상위');
    child = await workspace.cardFolders.createFolder('하위', [], parent.id);
  });
  await holdCard('첫 카드'); await press('선택'); await press('선택한 항목 폴더 이동');
  await press('이동 위치, 상위 폴더 열기'); await press('이동 위치, 하위 폴더 열기');
  const picker = document.querySelector('[data-testid="card-folder-picker"]');
  await press('새 폴더');
  expect(document.querySelector('[data-testid="card-folder-picker"]')).toBe(picker);
  await press('새 폴더 취소');
  expect(document.querySelector('[data-testid="card-folder-picker"]')).toBe(picker);
  expect(button('이동 위치, 상위 폴더 상위 열기')).not.toBeNull();
  await press('여기로 이동');
  expect(workspace.cardFolders.snapshot().value.items.find(item => item.id === cards[0]!.id)?.folderId).toBe(child.id);
  await press('상위 폴더'); await press('하위 폴더');
  expect(button('첫 카드 카드의 채팅 기록')).not.toBeNull();
  await press('카드 경로'); expect(button('둘째 카드 카드의 채팅 기록')).not.toBeNull();
});
it('selects folders with cards, supports unchecking through their menus and preserves folder contents on confirmed deletion', async () => {
  const {workspace, cards} = await cardHost();
  await act(async () => {await workspace.cardFolders.createFolder('보관', [cards[0]!.id]);});
  await hold('보관 폴더'); await press('선택'); await press('둘째 카드');
  await hold('둘째 카드'); await press('선택 해제');
  expect(button('둘째 카드').getAttribute('aria-checked')).toBe('false');
  await press('선택한 항목 삭제'); await press('삭제 확인');
  expect(workspace.cards).toHaveLength(3);
  expect(button('보관 폴더')).toBeNull();
  expect(button('첫 카드 카드의 채팅 기록')).not.toBeNull();
});
it('keeps folder move failures visible without dropping checks and retries the same destination', async () => {
  const {workspace, cards} = await cardHost();
  let folder!: {id: string};
  await act(async () => {folder = await workspace.cardFolders.createFolder('보관');});
  await holdCard('첫 카드'); await press('선택'); await press('선택한 항목 폴더 이동');
  await press('이동 위치, 보관 폴더 열기');
  const move = vi.spyOn(workspace.cardFolders, 'move').mockRejectedValueOnce(new Error('저장 실패'));
  await press('여기로 이동');
  expect(document.body.textContent).toContain('저장 실패');
  expect(document.querySelector('[data-testid="card-folder-picker"]')).not.toBeNull();
  await press('여기로 이동');
  expect(move).toHaveBeenCalledTimes(2);
  expect(workspace.cardFolders.snapshot().value.items.find(item => item.id === cards[0]!.id)?.folderId).toBe(folder.id);
  expect(document.querySelector('[data-testid="card-selection-footer"]')).toBeNull();
});
it('files chats within their owning card and moves them back out without changing the active room', async () => {
  repo = await repository();
  const card = await repo.insertCard(newCard()), other = await repo.insertCard(newCard());
  const room = await repo.createConversation(card.id, '이동할 대화'), keep = await repo.createConversation(other.id, '다른 카드 대화');
  const provider = new FixtureProvider();
  const workspace = new Workspace({repo, provider, creation: new CreationService(repo, new GenerationCoordinator(provider))});
  await workspace.ready(); await workspace.openConversation(room);
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<Host workspace={workspace} card={card}/>));
  await hold('이동할 대화 채팅 열기'); await press('폴더 이동');
  await input('폴더 이름', '대화 보관'); await press('새 폴더 완료');
  await press('대화 보관 폴더');
  expect(button('이동할 대화 채팅 열기')).not.toBeNull();
  expect(button('다른 카드 대화 채팅 열기')).toBeNull();
  await hold('이동할 대화 채팅 열기'); await press('선택'); await press('선택한 항목 폴더 이동');
  await press('이동 위치, 상위 폴더 채팅내역 열기'); await press('여기로 이동');
  await press('상위 폴더, 채팅내역');
  expect(button('이동할 대화 채팅 열기')).not.toBeNull();
  expect(workspace.history.selected?.id).toBe(room.id);
  expect((await repo.folderStore.read({kind: 'history', cardId: other.id})).items).toEqual([{id: keep.id, folderId: null}]);
  expect(close).not.toHaveBeenCalled();
});
