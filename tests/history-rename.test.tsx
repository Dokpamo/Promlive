// @vitest-environment jsdom
import {act, useEffect, useState, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {ItemRenameSheet} from '../src/layout/ItemRenameSheet';
import {DrawerModalLocks} from '../src/features/chat/DrawerGestureBoundary';
import type {Conversation} from '../src/features/chat/model';

vi.mock('react-native', () => vi.importActual('react-native-web'));
vi.mock('react-native-safe-area-context', () => ({useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0})}));
// Gesture/animation ownership is exercised separately in gesture-interruption.test.tsx.
vi.mock('../src/layout/SwipeBackModal', () => ({
  SwipeBackModal: ({children, onClose, onDismissStart, onShow}: {children: (close: () => void, style: object) => ReactNode; onClose: () => void; onDismissStart: () => void; onShow: () => void}) => {
    useEffect(onShow, []);
    return children(() => {onDismissStart(); onClose();}, {});
  },
  SwipeBackBoundary: ({children}: {children: ReactNode}) => children,
}));
vi.mock('../src/layout/KeyboardMotion', () => ({
  KeyboardMotionProvider: ({children}: {children: ReactNode}) => children,
  KeyboardDock: ({children}: {children: ReactNode}) => children,
  useKeyboardFrame: () => ({height: 0}),
}));
vi.mock('../src/layout/ScreenHeader', () => ({
  ScreenHeader: ({children}: {children: ReactNode}) => children,
  HeaderButton: ({label, onPress, disabled}: {label: string; onPress: () => void; disabled: boolean}) => <button aria-label={label} onClick={onPress} disabled={disabled}/>,
}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
const conversation: Conversation = {id: 'room', cardId: 'card', title: '원래 이름', createdAt: 1, updatedAt: 1};
let root: Root | undefined;
const locks = {current: 0};
afterEach(async () => {if (root) await act(async () => root!.unmount()); root = undefined; document.body.replaceChildren();});
async function setup(onSave = vi.fn<(title: string) => Promise<void>>().mockResolvedValue()) {
  const onClose = vi.fn();
  function Host() {
    const [open, setOpen] = useState(true);
    return <DrawerModalLocks.Provider value={locks}>{open && <ItemRenameSheet item={conversation} onSave={onSave} onClose={() => {onClose(); setOpen(false);}}/>}</DrawerModalLocks.Provider>;
  }
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<Host/>));
  return {onSave, onClose};
}
function input() {return document.querySelector<HTMLInputElement>('[aria-label="채팅 이름"]')!;}
function button(label: string) {return document.querySelector<HTMLElement>(`[aria-label="${label}"]`)!;}
async function press(label: string) {await act(async () => button(label).click());}
async function edit(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value);
    input().dispatchEvent(new Event('input', {bubbles: true}));
  });
}

it.each(['이름 변경 취소', '이름 변경 바깥 눌러 닫기'])('keeps editing local and discards the draft with %s', async label => {
  const {onSave, onClose} = await setup();
  expect(input().value).toBe(conversation.title);
  expect(document.activeElement).toBe(input());
  expect(locks.current).toBe(1);
  await edit('저장하지 않을 이름');
  expect(onSave).not.toHaveBeenCalled();
  await press(label);
  expect(onSave).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledOnce();
  expect(locks.current).toBe(0);
});

it('rejects a blank name and commits a trimmed name only once while saving', async () => {
  let resolve!: () => void;
  const onSave = vi.fn<(title: string) => Promise<void>>(() => new Promise(done => {resolve = done;}));
  const {onClose} = await setup(onSave);
  await edit('   '); await press('이름 변경 완료');
  expect(onSave).not.toHaveBeenCalled();
  await edit('  새 이름  '); await press('이름 변경 완료'); await press('이름 변경 완료');
  expect(onSave).toHaveBeenCalledExactlyOnceWith('새 이름');
  expect(onClose).not.toHaveBeenCalled();
  expect(input().readOnly).toBe(true);
  await act(async () => resolve());
  expect(onClose).toHaveBeenCalledOnce();
  expect(locks.current).toBe(0);
});

it('keeps the name and editor open after a save failure, then allows a retry', async () => {
  const onSave = vi.fn<(title: string) => Promise<void>>().mockRejectedValueOnce(new Error('저장 실패')).mockResolvedValue();
  const {onClose} = await setup(onSave);
  await edit('다시 저장할 이름');
  await act(async () => {input().dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));});
  expect(onSave).toHaveBeenCalledExactlyOnceWith('다시 저장할 이름');
  expect(onClose).not.toHaveBeenCalled();
  expect(input().value).toBe('다시 저장할 이름');
  expect(document.querySelector('[role="alert"]')?.textContent).toBe('저장 실패');
  await press('이름 변경 완료');
  expect(onSave).toHaveBeenCalledTimes(2);
  expect(onClose).toHaveBeenCalledOnce();
});

it('ignores late save completion after the editor has been dismissed', async () => {
  let resolve!: () => void;
  const onSave = vi.fn<(title: string) => Promise<void>>(() => new Promise(done => {resolve = done;}));
  const {onClose} = await setup(onSave);
  await press('이름 변경 완료'); await press('이름 변경 취소');
  expect(onClose).toHaveBeenCalledOnce();
  await act(async () => resolve());
  expect(onClose).toHaveBeenCalledOnce();
});
