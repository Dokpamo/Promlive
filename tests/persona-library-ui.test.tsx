// @vitest-environment jsdom
import {act, useEffect, useRef, useState, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {PersonaPage} from '../src/features/personas/PersonaPage';
import {PersonaProvider} from '../src/features/personas/PersonaContext';
import {PersonaPreferences} from '../src/features/personas/personaPreferences';

const editorExit = vi.hoisted(() => ({defer: false, finishes: [] as (() => void)[]}));

vi.mock('react-native', async () => {
  const React = await import('react');
  const native = await vi.importActual<typeof import('react-native')>('react-native-web');
  const View = React.forwardRef(({children, testID}: {children?: ReactNode; testID?: string}, ref) => {
    React.useImperativeHandle(ref, () => ({measureInWindow: (done: (...values: number[]) => void) => done(0, 200, 320, 600)}));
    return <div data-testid={testID}>{children}</div>;
  });
  const animate = (value: {setValue: (next: number) => void}, config: {toValue: number}) => ({start: (done?: (result: {finished: boolean}) => void) => {value.setValue(config.toValue); done?.({finished: true});}, stop() {}});
  return {...native, View,
    AccessibilityInfo: {isReduceMotionEnabled: async () => false, addEventListener: () => ({remove() {}})},
    Animated: {...native.Animated, View, timing: animate, spring: animate},
    FlatList: <T,>({data, renderItem, keyExtractor, ListHeaderComponent, ListFooterComponent}: {data: T[]; renderItem: (args: {item: T}) => ReactNode; keyExtractor: (item: T) => string; ListHeaderComponent: ReactNode; ListFooterComponent: ReactNode}) => <div>{ListHeaderComponent}{data.map(item => <div key={keyExtractor(item)}>{renderItem({item})}</div>)}{ListFooterComponent}</div>,
  };
});
vi.mock('react-native-safe-area-context', async () => ({SafeAreaView: (await import('react-native')).View, useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0})}));
// Native modal motion, hit testing and the real editor are checked on the emulator.
vi.mock('../src/layout/SwipeBackModal', () => ({
  SwipeBackModal: ({children, onClose, active}: {children: (close: () => void) => ReactNode; onClose: () => void; active: boolean}) => <div data-testid="page-gesture" data-active={active}>{children(onClose)}</div>,
  SwipeBackBoundary: ({children}: {children: ReactNode}) => children,
}));
vi.mock('../src/layout/ScreenHeader', () => ({
  ScreenHeader: ({children}: {children: ReactNode}) => children,
  HeaderButton: ({label, onPress}: {label: string; onPress: () => void}) => <button aria-label={label} onClick={onPress}/>,
}));
vi.mock('../src/layout/RowPressable', () => ({rowPressedScale: 0.96, RowPressable: ({children, onPress, onLongPress, accessibilityLabel, accessibilityRole, accessibilityState, disabled}: {
  children: ReactNode; onPress: () => void; onLongPress?: () => void; accessibilityLabel: string; accessibilityRole?: string; accessibilityState?: {checked?: boolean}; disabled?: boolean;
}) => <button role={accessibilityRole} aria-label={accessibilityLabel} aria-checked={accessibilityState?.checked} disabled={disabled} onClick={onPress} onContextMenu={event => {event.preventDefault(); onLongPress?.();}}>{children}</button>}));
vi.mock('../src/layout/PressSurface', () => ({PressSurface: ({children, onPress, disabled, accessibilityLabel}: {children: ReactNode; onPress: () => void; disabled: boolean; accessibilityLabel: string}) => <button aria-label={accessibilityLabel} disabled={disabled} onClick={onPress}>{children}</button>}));
vi.mock('../src/layout/ItemRenameSheet', () => ({ItemRenameSheet: ({item, heading = '이름 변경', onClose, onSave}: {item: {title: string}; heading?: string; onClose: () => void; onSave: (name: string) => Promise<void>}) => {
  const mounted = useRef(true);
  const [name, setName] = useState(item.title);
  const [error, setError] = useState('');
  useEffect(() => () => {mounted.current = false;}, []);
  return <div data-testid="folder-name-editor"><input aria-label="폴더 이름" value={name} onChange={event => setName(event.target.value)}/><button aria-label={`${heading} 취소`} onClick={onClose}/><button aria-label={`${heading} 완료`} onClick={() => {
    void onSave(name).then(() => {if (mounted.current) onClose();}, cause => {if (mounted.current) setError(cause.message);});
  }}/>{error && <span role="alert">{error}</span>}</div>;
}}));
vi.mock('../src/features/personas/PersonaEditorSheet', () => ({PersonaEditorSheet: ({item, onClose, onDismissStart}: {item?: {name: string}; onClose: () => void; onDismissStart: () => void}) => <div data-testid="editor">{item?.name}<button aria-label="편집 닫기" onClick={() => {
  onDismissStart();
  if (editorExit.defer) editorExit.finishes.push(onClose); else onClose();
}}/></div>}));
vi.mock('../src/features/settings/SettingsLayout', () => ({
  useSettingsScale: () => 0.6,
  SettingsSheet: ({children, footer, onClose, overlay, obscured, dismiss}: {children: (close: () => void) => ReactNode; footer?: (close: () => void) => ReactNode; onClose: () => void; overlay?: ReactNode; obscured?: boolean; dismiss?: boolean}) => {
    useEffect(() => {if (dismiss) onClose();}, [dismiss]);
    return <div data-testid="settings-sheet"><fieldset disabled={obscured}><button aria-label="폴더 선택 취소" onClick={onClose}/>{children(onClose)}{footer?.(onClose)}</fieldset>{overlay}</div>;
  },
}));
vi.mock('../src/features/profile/UserAvatar', () => ({UserAvatar: () => null}));
vi.mock('../src/features/settings/SettingsIcon', () => ({SettingsIcon: () => null}));

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(async () => {if (root) await act(async () => root!.unmount()); root = undefined; editorExit.defer = false; editorExit.finishes = []; document.body.replaceChildren();});
const fields = {name: '여행자', description: '', image: null};
async function setup() {
  const store = new PersonaPreferences({getSetting: async () => undefined, setSetting: async () => {}});
  const a = await store.create(fields), b = await store.create({...fields, name: '작가'});
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<PersonaProvider store={store}><PersonaPage onClose={() => {}}/></PersonaProvider>));
  return {store, a, b};
}
function button(label: string) {return document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;}
async function press(label: string) {await act(async () => button(label).click());}
async function hold(label: string) {await act(async () => button(label).dispatchEvent(new MouseEvent('contextmenu', {bubbles: true})));}
async function select(label: string) {await hold(label); await press('선택');}
async function search(value: string) {
  await act(async () => {
    const input = document.querySelector<HTMLInputElement>('[aria-label="페르소나 검색"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
}

it('opens a long-press menu without selecting or editing, and closes it without side effects', async () => {
  const {store} = await setup();
  const before = store.snapshot().value;
  await hold('여행자');
  expect([...document.querySelectorAll('[role="menuitem"]')].map(item => item.getAttribute('aria-label'))).toEqual(['선택', '폴더 이동', '페르소나 편집', '삭제']);
  expect(document.querySelector('[aria-checked]')).toBeNull();
  expect(document.querySelector('[data-testid="editor"]')).toBeNull();
  expect(document.querySelector('[data-testid="persona-drag-preview"]')).toBeNull();
  await press('페르소나 메뉴 닫기');
  expect(document.querySelector('[role="menuitem"]')).toBeNull();
  expect(store.snapshot().value).toBe(before);
  await press('여행자'); expect(document.querySelector('[data-testid="editor"]')).not.toBeNull();
});

it('opens the same persona editor from the item menu as from a normal tap', async () => {
  const {store} = await setup();
  const before = store.snapshot().value;
  await press('여행자');
  const tapped = document.querySelector('[data-testid="editor"]')!.textContent;
  await press('편집 닫기');
  await hold('여행자'); await press('페르소나 편집');
  expect(document.querySelector('[role="menuitem"]')).toBeNull();
  expect(document.querySelector('[data-testid="editor"]')!.textContent).toBe(tapped);
  expect(document.querySelector('[data-testid="folder-name-editor"]')).toBeNull();
  expect(store.snapshot().value).toBe(before);
});

it('restores page gestures as editing closes and ignores the old exit after opening another persona', async () => {
  editorExit.defer = true;
  await setup(); await press('여행자');
  const gesture = document.querySelector('[data-testid="page-gesture"]')!;
  expect(gesture.getAttribute('data-active')).toBe('false');
  await press('편집 닫기');
  expect(gesture.getAttribute('data-active')).toBe('true');
  expect(document.querySelector('[data-testid="editor"]')).not.toBeNull();
  await press('작가');
  expect(gesture.getAttribute('data-active')).toBe('false');
  await act(async () => editorExit.finishes[0]!());
  expect(document.querySelector('[data-testid="editor"]')?.textContent).toBe('작가');
});

it('moves a persona through the popup and can move it back out of a folder', async () => {
  const {store, a} = await setup();
  let folderId = '';
  await act(async () => {folderId = (await store.createFolder('보관')).id;});
  await hold('여행자'); await press('폴더 이동');
  expect(document.querySelector('[data-testid="persona-actions"]')).toBeNull();
  expect(button('여기로 이동').disabled).toBe(true);
  await press('이동 위치, 보관 폴더 열기');
  expect(store.snapshot().value.items.find(item => item.id === a.id)?.folderId).toBeNull();
  await press('여기로 이동');
  expect(store.snapshot().value.items.find(item => item.id === a.id)?.folderId).toBe(folderId);
  await press('보관 폴더'); await hold('여행자'); await press('폴더 이동');
  expect(button('여기로 이동').disabled).toBe(true);
  expect(button('이동 위치, 보관 경로')).not.toBeNull();
  await press('이동 위치, 페르소나 경로'); await press('여기로 이동');
  expect(store.snapshot().value.items.find(item => item.id === a.id)?.folderId).toBeNull();
});

it('supports folder popup moves and excludes the selected folder and its descendants', async () => {
  const {store} = await setup();
  let from = '', to = '';
  await act(async () => {
    from = (await store.createFolder('옮길 폴더')).id;
    await store.createFolder('하위', [], from);
    to = (await store.createFolder('목적지')).id;
  });
  await hold('옮길 폴더 폴더'); await press('폴더 이동');
  expect(button('이동 위치, 옮길 폴더 폴더 열기')).toBeNull();
  expect(button('이동 위치, 하위 폴더 열기')).toBeNull();
  await press('이동 위치, 목적지 폴더 열기'); await press('여기로 이동');
  expect(store.snapshot().value.folders.find(item => item.id === from)?.parentId).toBe(to);
});

it('browses nested destinations and ancestors without moving anything until confirmation', async () => {
  const {store, a, b} = await setup();
  let destination = '';
  await act(async () => {
    const outer = await store.createFolder('보관');
    const middle = await store.createFolder('작업', [], outer.id);
    destination = (await store.createFolder('완료', [], middle.id)).id;
    await store.createFolder('완료'); // Same name, different branch.
  });
  const before = store.snapshot().value;
  await select('여행자'); await press('작가'); await press('선택한 항목 폴더 이동');
  expect(button('이동 위치, 작업 폴더 열기')).toBeNull();
  await press('이동 위치, 보관 폴더 열기');
  expect(button('이동 위치, 완료 폴더 열기')).toBeNull();
  await press('이동 위치, 작업 폴더 열기'); await press('이동 위치, 완료 폴더 열기');
  const path = document.querySelector('[data-testid="persona-folder-picker-path"]')!;
  expect([...path.querySelectorAll('button')].map(node => node.getAttribute('aria-label'))).toEqual([
    '이동 위치, 페르소나 경로', '이동 위치, 보관 경로', '이동 위치, 작업 경로', '이동 위치, 완료 경로',
  ]);
  expect(button('이동 위치, 상위 폴더 작업 열기').textContent).toBe('작업');
  await press('이동 위치, 상위 폴더 작업 열기');
  expect(button('이동 위치, 완료 폴더 열기')).not.toBeNull();
  await press('이동 위치, 보관 경로');
  expect(button('이동 위치, 작업 폴더 열기')).not.toBeNull();
  expect(store.snapshot().value).toBe(before);
  await press('폴더 선택 취소');
  expect(store.snapshot().value).toBe(before);
  expect(button('작가').getAttribute('aria-checked')).toBe('true');
  await press('선택한 항목 폴더 이동');
  await press('이동 위치, 보관 폴더 열기'); await press('이동 위치, 작업 폴더 열기'); await press('이동 위치, 완료 폴더 열기');
  await press('여기로 이동');
  expect(store.snapshot().value.items.filter(item => [a.id, b.id].includes(item.id)).map(item => item.folderId)).toEqual([destination, destination]);
});

it('creates the new folder inside the browsed destination with its own next available name', async () => {
  const {store, a} = await setup();
  let parentId = '';
  await act(async () => {
    parentId = (await store.createFolder('보관')).id;
    await store.createFolder('새폴더 1', [], parentId);
    await store.createFolder('새폴더 3', [], parentId);
  });
  await hold('여행자'); await press('폴더 이동'); await press('이동 위치, 보관 폴더 열기'); await press('새 폴더');
  expect(document.querySelector<HTMLInputElement>('[aria-label="폴더 이름"]')!.value).toBe('새폴더 2');
  await press('새 폴더 완료');
  const created = store.snapshot().value.folders.find(item => item.name === '새폴더 2')!;
  expect(created.parentId).toBe(parentId);
  expect(store.snapshot().value.items.find(item => item.id === a.id)?.folderId).toBe(created.id);
  expect(document.querySelector('[data-testid="persona-folder-picker"]')).toBeNull();
});

it('keeps the same picker and destination beneath the name editor, including after cancelling', async () => {
  const {store} = await setup();
  await act(async () => {
    const outer = await store.createFolder('보관');
    await store.createFolder('작업', [], outer.id);
  });
  await select('여행자'); await press('선택한 항목 폴더 이동');
  await press('이동 위치, 보관 폴더 열기'); await press('이동 위치, 작업 폴더 열기');
  const picker = document.querySelector('[data-testid="persona-folder-picker"]');
  const sheet = document.querySelector('[data-testid="settings-sheet"]');
  const before = store.snapshot().value;
  await press('새 폴더');
  expect(document.querySelector('[data-testid="persona-folder-picker"]')).toBe(picker);
  expect(document.querySelector('[data-testid="settings-sheet"]')).toBe(sheet);
  expect(button('폴더 선택 취소').closest('fieldset')!.disabled).toBe(true);
  expect(button('여기로 이동').disabled).toBe(true);
  await press('이동 위치, 페르소나 경로'); // Obscured controls must not navigate.
  await press('새 폴더 취소');
  expect(document.querySelector('[data-testid="persona-folder-picker"]')).toBe(picker);
  expect(button('이동 위치, 상위 폴더 보관 열기')).not.toBeNull();
  expect(button('이동 위치, 작업 경로')).not.toBeNull();
  expect(button('여기로 이동').disabled).toBe(false);
  expect(store.snapshot().value).toBe(before);
  await press('폴더 선택 취소');
  expect(button('여행자').getAttribute('aria-checked')).toBe('true');
});

it('keeps both popup layers on creation failure and retries in the same parent', async () => {
  const {store, a} = await setup();
  let parentId = '';
  await act(async () => {parentId = (await store.createFolder('보관')).id;});
  await hold('여행자'); await press('폴더 이동'); await press('이동 위치, 보관 폴더 열기'); await press('새 폴더');
  vi.spyOn(store, 'createFolder').mockRejectedValueOnce(new Error('저장 실패'));
  await press('새 폴더 완료');
  expect(document.querySelector('[role="alert"]')?.textContent).toBe('저장 실패');
  expect(document.querySelector('[data-testid="persona-folder-picker"]')).not.toBeNull();
  expect(document.querySelector('[data-testid="folder-name-editor"]')).not.toBeNull();
  await press('새 폴더 완료');
  const created = store.snapshot().value.folders.find(item => item.name === '새폴더 1')!;
  expect(created.parentId).toBe(parentId);
  expect(store.snapshot().value.items.find(item => item.id === a.id)?.folderId).toBe(created.id);
  expect(document.querySelector('[data-testid="settings-sheet"]')).toBeNull();
});

it('finishes an already confirmed creation if its editor is closed during storage', async () => {
  const {store, a} = await setup();
  await act(async () => {await store.createFolder('보관');});
  await select('여행자'); await press('선택한 항목 폴더 이동'); await press('새 폴더');
  const createFolder = store.createFolder;
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  vi.spyOn(store, 'createFolder').mockImplementation(async (...args) => {await gate; return createFolder(...args);});
  await press('새 폴더 완료'); await press('새 폴더 취소');
  expect(document.querySelector('[data-testid="folder-name-editor"]')).toBeNull();
  expect(document.querySelector('[data-testid="persona-folder-picker"]')).not.toBeNull();
  expect(button('새 폴더').disabled).toBe(true);
  await act(async () => release());
  const created = store.snapshot().value.folders.find(item => item.name === '새폴더 1')!;
  expect(store.snapshot().value.items.find(item => item.id === a.id)?.folderId).toBe(created.id);
  expect(document.querySelector('[data-testid="settings-sheet"]')).toBeNull();
  expect(document.querySelector('[data-testid="persona-selection-footer"]')).toBeNull();
});

it('moves a folder into a nested destination with its contents still inside it', async () => {
  const {store, a} = await setup();
  let from = '', child = '', destination = '';
  await act(async () => {
    from = (await store.createFolder('옮길 폴더')).id;
    child = (await store.createFolder('내용', [a.id], from)).id;
    const outer = await store.createFolder('보관');
    destination = (await store.createFolder('하위', [], outer.id)).id;
  });
  await hold('옮길 폴더 폴더'); await press('폴더 이동');
  expect(button('이동 위치, 옮길 폴더 폴더 열기')).toBeNull();
  await press('이동 위치, 보관 폴더 열기'); await press('이동 위치, 하위 폴더 열기'); await press('여기로 이동');
  const value = store.snapshot().value;
  expect(value.folders.find(item => item.id === from)?.parentId).toBe(destination);
  expect(value.folders.find(item => item.id === child)?.parentId).toBe(from);
  expect(value.items.find(item => item.id === a.id)?.folderId).toBe(child);
});

it('locks destination navigation and double confirmation while a move is saving', async () => {
  const {store, a} = await setup();
  let destination = '';
  await act(async () => {destination = (await store.createFolder('보관')).id;});
  const original = store.move;
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  const move = vi.spyOn(store, 'move').mockImplementation(async (...args) => {await gate; await original(...args);});
  await hold('여행자'); await press('폴더 이동'); await press('이동 위치, 보관 폴더 열기'); await press('여기로 이동');
  for (const label of ['여기로 이동', '이동 위치, 페르소나 경로', '이동 위치, 상위 폴더 페르소나 열기', '새 폴더']) {
    expect(button(label).disabled).toBe(true);
    await press(label);
  }
  expect(move).toHaveBeenCalledExactlyOnceWith([a.id], destination, []);
  await act(async () => release());
  expect(store.snapshot().value.items.find(item => item.id === a.id)?.folderId).toBe(destination);
  expect(document.querySelector('[data-testid="persona-folder-picker"]')).toBeNull();
});

it('uses the selected set when moving from a selected item menu and can uncheck it from the menu', async () => {
  const {store, a, b} = await setup();
  let folderId = '';
  await act(async () => {folderId = (await store.createFolder('보관')).id;});
  await select('여행자'); await press('작가');
  await hold('여행자'); await press('선택 해제');
  expect(button('여행자').getAttribute('aria-checked')).toBe('false');
  await press('여행자'); await hold('작가'); await press('폴더 이동'); await press('이동 위치, 보관 폴더 열기'); await press('여기로 이동');
  expect(store.snapshot().value.items.filter(item => [a.id, b.id].includes(item.id)).every(item => item.folderId === folderId)).toBe(true);
  expect(document.querySelector('[data-testid="persona-selection-footer"]')).toBeNull();
});

it('still confirms deletion when it is requested directly from the menu', async () => {
  const {store} = await setup();
  await hold('여행자'); await press('삭제');
  expect(store.snapshot().value.items).toHaveLength(3);
  expect(document.querySelector('[data-testid="persona-delete-confirm"]')).not.toBeNull();
  await press('삭제 취소');
  expect(store.snapshot().value.items).toHaveLength(3);
});

it('opens editing on tap without changing the legacy selection or showing a selected persona', async () => {
  const {store} = await setup();
  expect(document.querySelector('[aria-checked]')).toBeNull();
  await press('여행자');
  expect(document.querySelector('[data-testid="editor"]')?.textContent).toContain('여행자');
  expect(store.snapshot().value.selectedId).toBe('default');
});

it('selects through the item menu; selection survives search and deletes exactly those entries', async () => {
  const {store} = await setup();
  await select('여행자');
  for (const label of ['선택', '삭제']) expect(button(label)).toBeNull();
  expect(button('여행자').getAttribute('aria-checked')).toBe('true');
  expect(button('폴더')).toBeNull();
  expect(button('복제')).toBeNull(); expect(document.querySelector('[data-testid="editor"]')).toBeNull();

  expect(button('선택한 항목 폴더 이동').disabled).toBe(false);
  await search('작가'); await press('작가');
  expect(button('선택한 항목 삭제').textContent).toBe('');
  expect(button('선택한 항목 폴더 이동').textContent).toBe('');
  await press('선택한 항목 삭제');
  expect(store.snapshot().value.items).toHaveLength(3);
  expect(document.querySelector('[data-testid="persona-delete-confirm"]')).not.toBeNull();
  await press('삭제 취소');
  expect(button('작가').getAttribute('aria-checked')).toBeNull();
  expect(document.querySelector('[data-testid="persona-selection-footer"]')).toBeNull();
  expect(store.snapshot().value.items).toHaveLength(3);
  await search(''); await select('여행자'); await press('작가');
  await press('선택한 항목 삭제'); await press('삭제 확인');
  expect(store.snapshot().value.items.map(item => item.id)).toEqual(['default']);
  expect(document.querySelector('[data-testid="persona-selection-footer"]')).toBeNull();
});

it('exits selection after the last check is cleared and then opens the editor on the next tap', async () => {
  await setup();
  await select('여행자'); await press('여행자');
  expect(document.querySelector('[aria-checked]')).toBeNull();
  expect(document.querySelector('[data-testid="persona-selection-footer"]')).toBeNull();
  await press('작가');
  expect(document.querySelector('[data-testid="editor"]')?.textContent).toContain('작가');
});

it('requires confirmation for deleting a selected item and keeps the dialog open after a failed save', async () => {
  const {store, a} = await setup();
  await select('여행자'); await press('선택한 항목 삭제');
  expect(store.snapshot().value.items.some(item => item.id === a.id)).toBe(true);
  await press('삭제 취소');
  expect(document.querySelector('[data-testid="persona-delete-confirm"]')).toBeNull();
  expect(store.snapshot().value.items.some(item => item.id === a.id)).toBe(true);
  await select('여행자'); await press('선택한 항목 삭제');
  vi.spyOn(store, 'removeMany').mockRejectedValueOnce(new Error('disk full'));
  await press('삭제 확인');
  expect(store.snapshot().value.items.some(item => item.id === a.id)).toBe(true);
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('삭제하지 못했어요.');
  await press('삭제 확인');
  expect(store.snapshot().value.items.some(item => item.id === a.id)).toBe(false);
  expect(document.querySelector('[data-testid="persona-delete-confirm"]')).toBeNull();
});

it('confirms folder deletion without removing its personas', async () => {
  const {store, a} = await setup();
  let folderId = '';
  await act(async () => {folderId = (await store.createFolder('보관', [a.id])).id;});
  await select('보관 폴더'); await press('선택한 항목 삭제'); await press('삭제 취소');
  expect(store.snapshot().value.folders[0]?.id).toBe(folderId);
  await select('보관 폴더'); await press('선택한 항목 삭제'); await press('삭제 확인');
  expect(store.snapshot().value.folders).toEqual([]);
  expect(store.snapshot().value.items.find(item => item.id === a.id)?.folderId).toBe(null);
  expect(button('여행자')).not.toBeNull();
});

it('submits a confirmed deletion only once while saving', async () => {
  const {store} = await setup();
  const original = store.removeMany;
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  const remove = vi.spyOn(store, 'removeMany').mockImplementation(async ids => {await gate; await original(ids);});
  await select('여행자'); await press('선택한 항목 삭제'); await press('삭제 확인'); await press('삭제 확인');
  expect(remove).toHaveBeenCalledTimes(1);
  expect(store.snapshot().value.items).toHaveLength(3);
  await act(async () => release());
  expect(store.snapshot().value.items).toHaveLength(2);
  expect(document.querySelector('[data-testid="persona-delete-confirm"]')).toBeNull();
});

it('selects folders and personas together and clears selection when deletion is cancelled', async () => {
  const {store, a, b} = await setup();
  await act(async () => {await store.createFolder('보관', [a.id]);});
  await select('작가'); await press('보관 폴더');
  expect(button('작가').getAttribute('aria-checked')).toBe('true');
  expect(button('보관 폴더').getAttribute('aria-checked')).toBe('true');
  expect(button('페르소나 목록으로 돌아가기')).toBeNull();
  expect(document.body.textContent).not.toContain('개 선택');
  await press('선택한 항목 삭제'); await press('삭제 취소');
  expect(button('보관 폴더').getAttribute('aria-checked')).toBeNull();
  expect(document.querySelector('[data-testid="persona-selection-footer"]')).toBeNull();
  await select('작가'); await press('보관 폴더');
  await press('선택한 항목 삭제'); await press('삭제 확인');
  expect(store.snapshot().value.folders).toEqual([]);
  expect(store.snapshot().value.items.some(item => item.id === b.id)).toBe(false);
  expect(store.snapshot().value.items.find(item => item.id === a.id)?.folderId).toBe(null);
  expect(document.querySelector('[data-testid="persona-selection-footer"]')).toBeNull();
});

it('starts selection from a folder and opens it normally after the final check is removed', async () => {
  const {store, a} = await setup();
  await act(async () => {await store.createFolder('보관', [a.id]);});
  await select('보관 폴더');
  expect(button('보관 폴더').getAttribute('aria-checked')).toBe('true');
  await press('보관 폴더');
  expect(document.querySelector('[aria-checked]')).toBeNull();
  await press('보관 폴더');
  expect(button('페르소나 목록으로 돌아가기')).not.toBeNull();
  expect(button('여행자')).not.toBeNull();
});

it('keeps confirmation open on outside clicks and Escape with cancel after delete', async () => {
  const {store} = await setup();
  await select('여행자'); await press('선택한 항목 삭제');
  const dialog = document.querySelector('[data-testid="persona-delete-confirm"]')!;
  expect([...dialog.querySelectorAll('button')].map(item => item.getAttribute('aria-label'))).toEqual(['삭제 확인', '삭제 취소']);
  await act(async () => {
    document.querySelector<HTMLElement>('[data-testid="persona-delete-overlay"]')!.click();
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
  });
  expect(document.querySelector('[data-testid="persona-delete-confirm"]')).toBe(dialog);
  expect(store.snapshot().value.items).toHaveLength(3);
  await press('삭제 취소');
  expect(document.querySelector('[data-testid="persona-delete-confirm"]')).toBeNull();
  expect(store.snapshot().value.items).toHaveLength(3);
});

it('opens folder actions only from selection, keeps checks on picker cancel and moves selected personas', async () => {
  const {store, a, b} = await setup();
  let folderId = '';
  await act(async () => {folderId = (await store.createFolder('보관')).id;});
  await select('여행자');
  expect(button('폴더')).toBeNull();
  await search('작가'); await press('작가');
  await press('선택한 항목 폴더 이동');
  expect(document.querySelector('[data-testid="persona-folder-picker"]')).not.toBeNull();
  expect(button('전체 목록으로 이동')).toBeNull();
  await press('폴더 선택 취소');
  expect(button('작가').getAttribute('aria-checked')).toBe('true');
  await press('선택한 항목 폴더 이동'); await press('이동 위치, 보관 폴더 열기'); await press('여기로 이동');
  expect(store.snapshot().value.items.filter(item => [a.id, b.id].includes(item.id)).map(item => item.folderId)).toEqual([folderId, folderId]);
  expect(document.querySelector('[data-testid="persona-folder-picker"]')).toBeNull();
  expect(document.querySelector('[data-testid="persona-selection-footer"]')).toBeNull();
});

it('keeps the folder picker open on save failure and permits retry', async () => {
  const {store, a} = await setup();
  let folderId = '';
  await act(async () => {folderId = (await store.createFolder('보관')).id;});
  await select('여행자'); await press('선택한 항목 폴더 이동');
  vi.spyOn(store, 'move').mockRejectedValueOnce(new Error('저장 실패'));
  await press('이동 위치, 보관 폴더 열기'); await press('여기로 이동');
  expect(store.snapshot().value.items.find(item => item.id === a.id)?.folderId).toBeNull();
  expect(document.querySelector('[role="alert"]')?.textContent).toBe('저장 실패');
  await press('여기로 이동');
  expect(store.snapshot().value.items.find(item => item.id === a.id)?.folderId).toBe(folderId);
});

it('opens the first folder name directly and creates it with the suggested name and checked personas', async () => {
  const {store, a, b} = await setup();
  await select('여행자'); await press('선택한 항목 폴더 이동');
  expect(document.querySelector('[data-testid="persona-folder-picker"]')).toBeNull();
  expect(document.querySelector('[data-testid="folder-name-editor"]')).not.toBeNull();
  expect(document.querySelector<HTMLInputElement>('[aria-label="폴더 이름"]')!.value).toBe('새폴더 1');
  await press('새 폴더 취소');
  expect(store.snapshot().value.folders).toEqual([]);
  expect(button('여행자').getAttribute('aria-checked')).toBe('true');
  await press('선택한 항목 폴더 이동');
  await press('새 폴더 완료');
  const folder = store.snapshot().value.folders.find(item => item.name === '새폴더 1');
  expect(folder).toBeDefined();
  expect(store.snapshot().value.items.find(item => item.id === a.id)?.folderId).toBe(folder!.id);
  expect(store.snapshot().value.items.find(item => item.id === b.id)?.folderId).toBeNull();
  expect(document.querySelector('[data-testid="persona-selection-footer"]')).toBeNull();
});

it('offers existing destinations and suggests the next available name when creating another folder', async () => {
  const {store, a} = await setup();
  await act(async () => {await store.createFolder('새폴더 1'); await store.createFolder('새폴더 3');});
  await select('여행자'); await press('선택한 항목 폴더 이동');
  expect(button('이동 위치, 새폴더 1 폴더 열기')).not.toBeNull();
  expect(button('전체 목록으로 이동')).toBeNull();
  await press('새 폴더');
  expect(document.querySelector('[data-testid="persona-folder-picker"]')).not.toBeNull();
  expect(document.querySelector<HTMLInputElement>('[aria-label="폴더 이름"]')!.value).toBe('새폴더 2');
  await press('새 폴더 완료');
  const folder = store.snapshot().value.folders.find(item => item.name === '새폴더 2')!;
  expect(folder).toBeDefined();
  expect(store.snapshot().value.items.find(item => item.id === a.id)?.folderId).toBe(folder.id);
});

it('clears selection when the empty list area is tapped', async () => {
  await setup();
  await select('여행자'); await press('작가');
  await press('빈 공간 눌러 선택 해제');
  expect(document.querySelector('[aria-checked]')).toBeNull();
  expect(document.querySelector('[data-testid="persona-selection-footer"]')).toBeNull();
  await press('여행자');
  expect(document.querySelector('[data-testid="editor"]')?.textContent).toContain('여행자');
});

it('shows the parent row inside a folder and navigates back one level at a time', async () => {
  const {store, a} = await setup();
  await act(async () => {
    const outer = await store.createFolder('상위');
    await store.createFolder('하위', [a.id], outer.id);
  });
  expect(button('하위 폴더')).toBeNull();
  await press('상위 폴더');
  expect(button('상위 폴더, 페르소나')).not.toBeNull();
  expect(button('상위 폴더, 페르소나').textContent).toBe('페르소나');
  await press('하위 폴더');
  expect(button('상위 폴더, 상위')).not.toBeNull();
  expect(button('상위 폴더, 상위').textContent).toBe('상위');
  expect(button('여행자')).not.toBeNull();
  await press('상위 폴더, 상위');
  expect(button('상위 폴더, 상위')).toBeNull();
  expect(button('상위 폴더, 페르소나')).not.toBeNull();
  await press('상위 폴더, 페르소나');
  expect(button('상위 폴더, 페르소나')).toBeNull();
});

it('shows the full folder path and can return directly to a distant ancestor', async () => {
  const {store, a} = await setup();
  await act(async () => {
    const outer = await store.createFolder('상위');
    const middle = await store.createFolder('중간', [], outer.id);
    await store.createFolder('하위', [a.id], middle.id);
  });
  await press('상위 폴더'); await press('중간 폴더'); await press('하위 폴더');
  const paths = document.querySelectorAll('[data-testid="persona-folder-path"]');
  const current = paths[paths.length - 1]!;
  expect([...current.querySelectorAll('button')].map(node => node.getAttribute('aria-label'))).toEqual(['페르소나 경로', '상위 경로', '중간 경로', '하위 경로']);
  await act(async () => current.querySelector<HTMLButtonElement>('[aria-label="상위 경로"]')!.click());
  expect(button('하위 경로')).toBeNull(); expect(button('중간 폴더')).not.toBeNull();
  const remaining = document.querySelectorAll('[data-testid="persona-folder-path"]');
  await act(async () => remaining[remaining.length - 1]!.querySelector<HTMLButtonElement>('[aria-label="페르소나 경로"]')!.click());
  expect(button('상위 폴더, 페르소나')).toBeNull();
});

it('cancels selection from the shared bottom bar without editing or deleting personas', async () => {
  const {store} = await setup();
  const before = store.snapshot().value;
  await select('여행자'); await press('작가');
  expect(document.querySelector('[data-testid="persona-selection-footer"]')!.contains(button('선택 취소'))).toBe(true);
  expect(button('페르소나 선택 취소')).toBeNull();
  await press('선택 취소');
  expect(document.querySelector('[aria-checked]')).toBeNull();
  expect(document.querySelector('[data-testid="persona-selection-footer"]')).toBeNull();
  expect(store.snapshot().value).toBe(before);
});

it('renames a folder from its menu without changing its contents or sibling names', async () => {
  const {store, a} = await setup();
  let id = '';
  await act(async () => {id = (await store.createFolder('보관', [a.id])).id; await store.createFolder('다른 폴더');});
  await hold('보관 폴더'); await press('이름 변경');
  const edit = async (name: string) => act(async () => {
    const input = document.querySelector<HTMLInputElement>('[aria-label="폴더 이름"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, name);
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
  await edit('취소할 이름'); await press('이름 변경 취소');
  expect(store.snapshot().value.folders.find(folder => folder.id === id)?.name).toBe('보관');
  await hold('보관 폴더'); await press('이름 변경');
  await edit('이야기'); await press('이름 변경 완료');
  expect(button('이야기 폴더')).not.toBeNull();
  expect(button('보관 폴더')).toBeNull();
  expect(store.snapshot().value.items.find(item => item.id === a.id)?.folderId).toBe(id);
  expect(store.snapshot().value.folders.map(folder => folder.name)).toEqual(['이야기', '다른 폴더']);
  await press('이야기 폴더');
  expect(button('여행자')).not.toBeNull();
});
