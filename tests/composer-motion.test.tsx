// @vitest-environment jsdom
import {act, useImperativeHandle, useLayoutEffect, useRef, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {Animated} from 'react-native';
import {ChatComposer} from '../src/features/chat/ChatComposer';
import {DrawerModalLocks} from '../src/features/chat/DrawerGestureBoundary';
import type {ComposerInputProps} from '../src/features/chat/ComposerInput.types';

const keyboard = vi.hoisted(() => ({height: 0}));
const opening = vi.hoisted(() => ({defer: false, callbacks: [] as (() => void)[]}));
const accessibility = vi.hoisted(() => ({reduceMotion: true}));
vi.mock('react-native', async () => {
  const native = await vi.importActual<typeof import('react-native')>('react-native-web');
  return {...native,
    useWindowDimensions: () => ({width: 412, height: 892, fontScale: 1, scale: 1}),
    AccessibilityInfo: {isReduceMotionEnabled: async () => accessibility.reduceMotion, addEventListener: () => ({remove() {}})},
  };
});
vi.mock('react-native-safe-area-context', () => ({useSafeAreaInsets: () => ({top: 24, right: 0, bottom: 24, left: 0})}));
vi.mock('../src/layout/KeyboardMotion', () => ({useKeyboardFrame: () => keyboard, KeyboardDock: ({children}: {children: ReactNode}) => <div>{children}</div>}));
vi.mock('../src/features/appearance/AppAppearance', async () => {
  const {lightChatColors: colors} = await import('../src/features/chat/chatAppearance');
  return {useAppearance: () => ({colors, isDark: false, settings: {sheet: '#fff', selected: '#eee', divider: '#ddd'}})};
});
// Replace the native widget only. Its DOM node, focus and selection must survive
// the real composer's expansion, collapse and keyboard frame changes.
vi.mock('../src/features/chat/ComposerInput', () => ({ComposerInput: (p: ComposerInputProps) => {
  const node = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(p.focusRef, () => ({
    focus: () => node.current?.focus(), isFocused: () => node.current === document.activeElement,
    focusForExpansion: onKeyboardStart => {
      node.current?.focus();
      if (opening.defer) opening.callbacks.push(onKeyboardStart);
      else onKeyboardStart();
    },
    getSelection: () => ({start: node.current?.selectionStart ?? 0, end: node.current?.selectionEnd ?? 0}), setSelection: () => {},
  }), []);
  useLayoutEffect(() => {p.onHeight(1800);}, [p.onHeight]);
  return <textarea ref={node} data-testid={p.testID} data-viewport={p.height} value={p.value} onChange={e => p.onChange(e.target.value)}/>;
}}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
const locks = {current: 0};
const change = vi.fn();
async function render() {
  if (!root) {const container = document.createElement('div'); document.body.append(container); root = createRoot(container);}
  await act(async () => root!.render(<DrawerModalLocks.Provider value={locks}><ChatComposer value="작성 중인 긴 메시지" onChange={change} onSend={() => {}} onCancel={() => {}} onHint={() => {}} width={412} bottom={24} ready action={{kind: 'send', enabled: true, label: '메시지 보내기'}}/></DrawerModalLocks.Provider>));
}
async function press(label: string) {
  await act(async () => (document.querySelector(`[aria-label="${label}"]`) as HTMLElement).click());
}
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined; keyboard.height = 0; change.mockClear();
  opening.defer = false; opening.callbacks = [];
  accessibility.reduceMotion = true; vi.restoreAllMocks();
  document.body.replaceChildren();
});

it('keeps the same editor, selection and draft through repeated expansion and collapse', async () => {
  await render();
  const original = document.querySelector('textarea')!;
  original.focus(); original.setSelectionRange(3, 7);
  for (let count = 0; count < 3; count++) {
    await press('입력창 크게 열기');
    expect(document.querySelectorAll('textarea')).toHaveLength(1);
    expect(document.querySelector('textarea')).toBe(original);
    expect(locks.current).toBe(1);
    await press('입력창 접기');
    expect(document.querySelector('textarea')).toBe(original);
    expect([original.selectionStart, original.selectionEnd]).toEqual([3, 7]);
    expect(locks.current).toBe(0);
  }
  expect(change).not.toHaveBeenCalled();
});

it('restores the whole available editor viewport after the keyboard disappears', async () => {
  await render(); await press('입력창 크게 열기');
  const editor = document.querySelector('textarea')!;
  const viewport = document.querySelector<HTMLElement>('[data-testid="composer-scroll-viewport"]')!;
  const full = parseFloat(viewport.style.height);
  expect(parseFloat(viewport.style.top)).toBe(0);
  keyboard.height = 336;
  await render();
  const reduced = parseFloat(viewport.style.height);
  expect(reduced).toBeLessThan(full - 250);
  keyboard.height = 0;
  await render();
  expect(parseFloat(viewport.style.height)).toBe(full);
  expect(document.querySelector('textarea')).toBe(editor);
  expect(change).not.toHaveBeenCalled();
});

it('keeps the text column width unchanged through expansion and collapse', async () => {
  await render();
  const viewport = () => document.querySelector<HTMLElement>('[data-testid="composer-scroll-viewport"]')!;
  const compactWidth = parseFloat(viewport().style.width);
  expect(compactWidth).toBeGreaterThan(300);
  await press('입력창 크게 열기');
  expect(parseFloat(viewport().style.width)).toBe(compactWidth);
  await press('입력창 접기');
  expect(parseFloat(viewport().style.width)).toBe(compactWidth);
});

it('reverses the full-screen expansion into the same compact editor without losing focus or selection', async () => {
  accessibility.reduceMotion = false;
  await render();
  const editor = document.querySelector('textarea')!;
  editor.focus(); editor.setSelectionRange(3, 7);
  const surfaceHeight = () => parseFloat(document.querySelector<HTMLElement>('[data-testid="expanded-composer-surface"], [data-testid="chat-composer"]')!.style.height);
  const compactHeight = surfaceHeight();
  const runs: {value: Animated.Value; target: number; finish: ((result: {finished: boolean}) => void) | undefined}[] = [];
  vi.spyOn(Animated, 'spring').mockImplementation((value, config) => {
    const run = {value: value as Animated.Value, target: config.toValue as number, finish: undefined as ((result: {finished: boolean}) => void) | undefined};
    runs.push(run);
    return {start: callback => {run.finish = callback;}, stop: () => run.finish?.({finished: false}), reset: () => {}};
  });
  await press('입력창 크게 열기');
  await act(async () => runs[0]!.value.setValue(0.65));
  const midway = surfaceHeight();
  expect(midway).toBeGreaterThan(compactHeight);
  expect(midway).toBeLessThan(892);
  await press('입력창 접기');
  expect(surfaceHeight()).toBe(midway);
  await act(async () => runs[2]!.value.setValue(0.25));
  expect(surfaceHeight()).toBeGreaterThan(compactHeight);
  expect(surfaceHeight()).toBeLessThan(midway);
  await act(async () => {
    for (const run of runs.slice(2)) {run.value.setValue(run.target); run.finish?.({finished: true});}
  });
  expect(surfaceHeight()).toBe(compactHeight);
  expect(document.querySelector('textarea')).toBe(editor);
  expect(document.activeElement).toBe(editor);
  expect([editor.selectionStart, editor.selectionEnd]).toEqual([3, 7]);
  expect(locks.current).toBe(0);
  expect(change).not.toHaveBeenCalled();
});

it('requests focus immediately and starts expanding when the keyboard starts moving', async () => {
  opening.defer = true;
  await render();
  const editor = document.querySelector('textarea')!;
  await press('입력창 크게 열기');
  expect(document.activeElement).toBe(editor);
  expect(editor.dataset.testid).toBe('chat-input');
  expect(locks.current).toBe(1);
  await act(async () => opening.callbacks[0]!());
  expect(editor.dataset.testid).toBe('expanded-composer-input');
  expect(document.querySelector('textarea')).toBe(editor);
});

it('ignores a late keyboard callback after cancellation or a newer expansion request', async () => {
  opening.defer = true;
  await render(); await press('입력창 크게 열기');
  await press('입력창 바깥 눌러 접기');
  expect(locks.current).toBe(0);
  await press('입력창 크게 열기');
  await act(async () => opening.callbacks[0]!());
  expect(document.querySelector('textarea')?.dataset.testid).toBe('chat-input');
  await act(async () => opening.callbacks[1]!());
  expect(document.querySelector('textarea')?.dataset.testid).toBe('expanded-composer-input');
});
