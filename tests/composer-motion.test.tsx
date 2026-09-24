// @vitest-environment jsdom
import {act, useImperativeHandle, useLayoutEffect, useRef, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {Animated, Keyboard} from 'react-native';
import {ChatComposer} from '../src/features/chat/ChatComposer';
import {DrawerModalLocks} from '../src/features/chat/DrawerGestureBoundary';
import type {ComposerInputProps, ComposerSelection} from '../src/features/chat/ComposerInput.types';
import type {SheetScrollViewProps} from '../src/layout/SheetScrollView';

const keyboard = vi.hoisted(() => ({height: 0}));
const opening = vi.hoisted(() => ({defer: false, callbacks: [] as (() => void)[]}));
const accessibility = vi.hoisted(() => ({reduceMotion: true}));
const measurement = vi.hoisted(() => ({height: 1800}));
const scrollViews = vi.hoisted(() => new Map<string, {offset: number; props: SheetScrollViewProps}>());
vi.mock('react-native', async () => {
  const native = await vi.importActual<typeof import('react-native')>('react-native-web');
  return {...native,
    useWindowDimensions: () => ({width: 412, height: 892, fontScale: 1, scale: 1}),
    AccessibilityInfo: {isReduceMotionEnabled: async () => accessibility.reduceMotion, addEventListener: () => ({remove() {}})},
  };
});
vi.mock('react-native-safe-area-context', () => ({useSafeAreaInsets: () => ({top: 24, right: 0, bottom: 24, left: 0})}));
vi.mock('../src/layout/KeyboardMotion', () => ({useKeyboardFrame: () => keyboard, KeyboardDock: ({children}: {children: ReactNode}) => <div>{children}</div>}));
// Model actual scroll ranges; jsdom itself has no measured viewport or scrolling.
vi.mock('../src/layout/SheetScrollView', () => ({SheetScrollView: (p: SheetScrollViewProps) => {
  const state = useRef({offset: p.contentOffset?.y ?? 0, props: p});
  state.current.props = p;
  scrollViews.set(p.testID!, state.current);
  useImperativeHandle(p.ref, () => ({scrollTo: ({y}: {y: number}) => {
    const props = state.current.props;
    const offset = Math.max(0, Math.min(y, props.sheetScroll.current.maxOffset ?? 0));
    state.current.offset = offset;
    props.onScroll?.({nativeEvent: {contentOffset: {x: 0, y: offset}}} as Parameters<NonNullable<SheetScrollViewProps['onScroll']>>[0]);
  }} as import('react-native').ScrollView), []);
  useLayoutEffect(() => {p.onLayout?.({} as Parameters<NonNullable<SheetScrollViewProps['onLayout']>>[0]);}, [p.onLayout]);
  return <div data-testid={p.testID}>{p.children}</div>;
}}));
vi.mock('../src/features/appearance/AppAppearance', async () => {
  const {lightChatColors: colors} = await import('../src/features/chat/chatAppearance');
  return {useAppearance: () => ({colors, isDark: false, settings: {sheet: '#fff', selected: '#eee', divider: '#ddd'}})};
});
// Replace the native widget only; exercise the real focus handoff and overlay lifecycle.
vi.mock('../src/features/chat/ComposerInput', () => ({ComposerInput: (p: ComposerInputProps) => {
  const node = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(p.focusRef, () => {
    const setSelection = (next: ComposerSelection) => node.current?.setSelectionRange(next.start, next.end);
    return {
      focus: next => {node.current?.focus(); if (next) setSelection(next);},
      isFocused: () => node.current === document.activeElement,
      focusForExpansion: onKeyboardStart => {
        node.current?.focus();
        if (opening.defer) opening.callbacks.push(onKeyboardStart); else onKeyboardStart();
      },
      getSelection: () => ({start: node.current?.selectionStart ?? 0, end: node.current?.selectionEnd ?? 0}), setSelection,
    };
  }, []);
  const height = measurement.height;
  useLayoutEffect(() => {p.onHeight(height);}, [height, p.onHeight]);
  return <textarea ref={node} data-testid={p.testID ?? 'chat-input'} value={p.value} onChange={e => p.onChange(e.target.value)} onFocus={p.onFocus} onBlur={p.onBlur}
    onSelect={e => p.onSelectionChange?.({start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd})}/>;
}}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let draft = '작성 중인 긴 메시지';
const locks = {current: 0};
const change = vi.fn(), send = vi.fn();
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.querySelector<T>(`[data-testid="${id}"]`)!;
async function render(value = draft) {
  draft = value;
  if (!root) {const container = document.createElement('div'); document.body.append(container); root = createRoot(container);}
  await act(async () => root!.render(<DrawerModalLocks.Provider value={locks}><ChatComposer value={draft} onChange={change} onSend={send} onCancel={() => {}} onHint={() => {}} width={412} bottom={24} ready action={{kind: 'send', enabled: true, label: '메시지 보내기'}}/></DrawerModalLocks.Provider>));
}
async function press(label: string) {await act(async () => (document.querySelector(`[aria-label="${label}"]`) as HTMLElement).click());}
async function readAt(id: string, offset: number) {
  await act(async () => {
    const view = scrollViews.get(id)!;
    const event = {nativeEvent: {contentOffset: {x: 0, y: offset}}} as Parameters<NonNullable<SheetScrollViewProps['onScroll']>>[0];
    view.props.onScrollBeginDrag?.(event);
    view.offset = offset;
    view.props.onScroll?.(event);
  });
}
function controlAnimations() {
  const runs: {value: Animated.Value; target: number; duration?: number | undefined; physics?: {stiffness: number | undefined; damping: number | undefined; mass: number | undefined}; finish: ((result: {finished: boolean}) => void) | undefined}[] = [];
  vi.spyOn(Animated, 'spring').mockImplementation((value, config) => {
    const run = {value: value as Animated.Value, target: config.toValue as number, physics: {stiffness: config.stiffness, damping: config.damping, mass: config.mass}, finish: undefined as ((result: {finished: boolean}) => void) | undefined};
    runs.push(run);
    return {start: callback => {run.finish = callback;}, stop: () => run.finish?.({finished: false}), reset: () => {}};
  });
  vi.spyOn(Animated, 'timing').mockImplementation((value, config) => {
    const run = {value: value as Animated.Value, target: config.toValue as number, duration: config.duration, finish: undefined as ((result: {finished: boolean}) => void) | undefined};
    runs.push(run);
    return {start: callback => {run.finish = callback;}, stop: () => run.finish?.({finished: false}), reset: () => {}};
  });
  return runs;
}
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined; keyboard.height = 0; change.mockClear(); send.mockClear();
  opening.defer = false; opening.callbacks = []; measurement.height = 1800; scrollViews.clear();
  accessibility.reduceMotion = true; draft = '작성 중인 긴 메시지'; vi.restoreAllMocks();
  document.body.replaceChildren();
});

it('keeps the original bar mounted and returns draft, selection and focus after repeated full-screen editing', async () => {
  await render();
  const original = element<HTMLTextAreaElement>('chat-input');
  const bar = element('chat-composer');
  const geometry = bar.style.cssText;
  await act(async () => {original.focus(); original.setSelectionRange(3, 7);});
  const dismissKeyboard = vi.spyOn(Keyboard, 'dismiss');
  for (let count = 0; count < 3; count++) {
    await press('입력창 크게 열기');
    const full = element<HTMLTextAreaElement>('expanded-composer-input');
    expect(full).not.toBe(original);
    expect(document.querySelectorAll('textarea')).toHaveLength(2);
    expect(element('chat-composer')).toBe(bar);
    expect(bar.style.cssText).toBe(geometry);
    expect(element('chat-input')).toBe(original);
    expect(full.value).toBe(original.value);
    expect([full.selectionStart, full.selectionEnd]).toEqual([3, 7]);
    expect(document.activeElement).toBe(full);
    expect(locks.current).toBe(1);
    await press('입력창 접기');
    expect(element('expanded-composer-surface')).toBeNull();
    expect(element('chat-input')).toBe(original);
    expect(document.activeElement).toBe(original);
    expect([original.selectionStart, original.selectionEnd]).toEqual([3, 7]);
    expect(locks.current).toBe(0);
  }
  expect(change).not.toHaveBeenCalled();
  expect(dismissKeyboard).not.toHaveBeenCalled();
});

it('keeps the full-screen surface fixed while restoring its text viewport after keyboard dismissal', async () => {
  await render(); await press('입력창 크게 열기');
  const editor = element('expanded-composer-input');
  const surface = element('expanded-composer-surface');
  const geometry = surface.style.cssText;
  const viewport = element('expanded-composer-scroll-viewport');
  const full = parseFloat(viewport.style.height);
  expect(parseFloat(viewport.style.top)).toBe(0);
  keyboard.height = 336; await render();
  expect(parseFloat(viewport.style.height)).toBeLessThan(full - 250);
  expect(surface.style.cssText).toBe(geometry);
  keyboard.height = 0; await render();
  expect(parseFloat(viewport.style.height)).toBe(full);
  expect(element('expanded-composer-input')).toBe(editor);
});

it('preserves the text column and shares edits with the original bar', async () => {
  await render();
  const width = element('composer-scroll-viewport').style.width;
  await press('입력창 크게 열기');
  expect(element('expanded-composer-scroll-viewport').style.width).toBe(width);
  const full = element<HTMLTextAreaElement>('expanded-composer-input');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(full, '수정한 초안');
    full.dispatchEvent(new Event('input', {bubbles: true}));
  });
  expect(change).toHaveBeenLastCalledWith('수정한 초안');
  await render('수정한 초안');
  full.setSelectionRange(2, 2);
  await press('입력창 접기');
  const compact = element<HTMLTextAreaElement>('chat-input');
  expect(compact.value).toBe('수정한 초안');
  expect(compact.selectionStart).toBe(2);
});

it.each([0, 336])('uses the entrance spring to settle at the visible exit edge with keyboard height %s', async keyboardHeight => {
  keyboard.height = keyboardHeight;
  accessibility.reduceMotion = false;
  await render();
  const runs = controlAnimations();
  const bar = element('chat-composer'), geometry = bar.style.cssText;
  await press('입력창 크게 열기');
  const surface = element('expanded-composer-surface');
  const entry = runs.find(run => run.target === 0)!;
  expect(surface.style.transform).toContain('892px');
  await act(async () => entry.value.setValue(400));
  expect(surface.style.transform).toContain('400px');
  expect(bar.style.cssText).toBe(geometry);
  await act(async () => {entry.value.setValue(0); entry.finish?.({finished: true});});
  await press('입력창 접기');
  expect(element('expanded-composer-surface')).toBe(surface);
  expect(locks.current).toBe(0);
  const target = 892 - keyboardHeight;
  const exit = runs.find(run => run.target === target)!;
  expect(exit.physics).toBeDefined();
  expect(exit.physics).toEqual(entry.physics);
  await act(async () => exit.value.setValue(500));
  expect(surface.style.transform).toContain('500px');
  expect(bar.style.cssText).toBe(geometry);
  await act(async () => {exit.value.setValue(target); exit.finish?.({finished: true});});
  expect(element('expanded-composer-surface')).toBeNull();
  expect(locks.current).toBe(0);
});

it('focuses the overlay immediately and waits for the keyboard to begin its entrance', async () => {
  accessibility.reduceMotion = false; opening.defer = true;
  await render(); const runs = controlAnimations();
  await press('입력창 크게 열기');
  expect(document.activeElement).toBe(element('expanded-composer-input'));
  expect(element('expanded-composer-surface').style.transform).toContain('892px');
  expect(runs).toHaveLength(0);
  expect(locks.current).toBe(1);
  await act(async () => opening.callbacks[0]!());
  expect(runs.some(run => run.target === 0)).toBe(true);
});

it('starts expansion immediately when the keyboard is already open, keeping focus in an editor', async () => {
  keyboard.height = 336; accessibility.reduceMotion = false; opening.defer = true;
  await render();
  await act(async () => element('chat-input').focus());
  const runs = controlAnimations();
  const hide = vi.spyOn(Keyboard, 'dismiss');
  await press('입력창 크게 열기');
  expect(document.activeElement).toBe(element('expanded-composer-input'));
  expect(runs.some(run => run.target === 0)).toBe(true);
  expect(opening.callbacks).toHaveLength(1);
  expect(hide).not.toHaveBeenCalled();
});

it('ignores a late keyboard callback from a closed overlay', async () => {
  opening.defer = true;
  await render(); await press('입력창 크게 열기');
  await press('입력창 접기');
  expect(locks.current).toBe(0);
  await press('입력창 크게 열기');
  const current = element('expanded-composer-input');
  await act(async () => opening.callbacks[0]!());
  expect(element('expanded-composer-input')).toBe(current);
  expect(locks.current).toBe(1);
  await act(async () => opening.callbacks[1]!());
  expect(document.activeElement).toBe(current);
});

it('gives new text its complete viewport before the surrounding bar finishes growing', async () => {
  accessibility.reduceMotion = false; measurement.height = 25;
  await render('첫 줄');
  const runs = controlAnimations();
  const barHeight = element('chat-composer').style.height;
  measurement.height = 50; await render('첫 줄\n둘째 줄');
  expect(element('composer-scroll-viewport').style.height).toBe('50px');
  expect(element('chat-composer').style.height).toBe(barHeight);
  expect(runs.some(run => run.target > parseFloat(barHeight))).toBe(true);
});

it('shows and hides send immediately without an entrance transform or fade', async () => {
  accessibility.reduceMotion = false; measurement.height = 25;
  await render(''); controlAnimations();
  expect(element('composer-send-control')).toBeNull();
  await render('안녕');
  const control = element('composer-send-control');
  expect(control.style.transform).toBe('');
  expect(control.style.opacity).toBe('');
  expect(control.parentElement).toBe(element('composer-controls-layer'));
  await press('메시지 보내기');
  expect(send).toHaveBeenCalledTimes(1);
  await render('');
  expect(element('composer-send-control')).toBeNull();
});

it('preserves the reading position rather than jumping to the cursor on expand and collapse', async () => {
  keyboard.height = 336;
  await render();
  await act(async () => element<HTMLTextAreaElement>('chat-input').setSelectionRange(draft.length, draft.length));
  await readAt('composer-scroll', 420);
  await press('입력창 크게 열기');
  expect(scrollViews.get('expanded-composer-scroll')!.offset).toBe(420);
  await press('입력창 접기');
  expect(scrollViews.get('composer-scroll')!.offset).toBe(420);
});

it('returns at the new reading position after scrolling the expanded editor', async () => {
  keyboard.height = 336;
  await render(); await readAt('composer-scroll', 420);
  await press('입력창 크게 열기');
  await readAt('expanded-composer-scroll', 760);
  await press('입력창 접기');
  expect(scrollViews.get('composer-scroll')!.offset).toBe(760);
});

it('lets a fresh scroll interrupt restoration while the full-screen editor is still closing', async () => {
  keyboard.height = 336; accessibility.reduceMotion = false;
  await render(); await readAt('composer-scroll', 420);
  const runs = controlAnimations();
  await press('입력창 크게 열기');
  const entry = runs.find(run => run.target === 0)!;
  await act(async () => {entry.value.setValue(0); entry.finish?.({finished: true});});
  await press('입력창 접기');
  await readAt('composer-scroll', 660);
  const exit = runs.find(run => run.target === 556)!;
  await act(async () => {exit.value.setValue(556); exit.finish?.({finished: true});});
  expect(scrollViews.get('composer-scroll')!.offset).toBe(660);
});

it('remembers the compact reading position when all the text fits in the expanded viewport', async () => {
  measurement.height = 300;
  await render(); await readAt('composer-scroll', 100);
  await press('입력창 크게 열기');
  expect(scrollViews.get('expanded-composer-scroll')!.offset).toBe(0);
  await press('입력창 접기');
  expect(scrollViews.get('composer-scroll')!.offset).toBe(100);
});

it('clamps the returned scroll position if text was shortened while expanded', async () => {
  await render(); await readAt('composer-scroll', 420);
  await press('입력창 크게 열기');
  measurement.height = 50; await render('짧은\n메시지');
  await press('입력창 접기');
  expect(scrollViews.get('composer-scroll')!.offset).toBe(0);
});

it('keeps an empty editing bar open until focus leaves it', async () => {
  measurement.height = 25;
  await render('안녕');
  await act(async () => element('chat-input').focus());
  const expandedHeight = element('chat-composer').style.height;
  await render('');
  expect(element('chat-composer').style.height).toBe(expandedHeight);
  await act(async () => element('chat-input').blur());
  expect(parseFloat(element('chat-composer').style.height)).toBeLessThan(parseFloat(expandedHeight));
});

it('collapses an empty bar when the keyboard closes even if native focus remains', async () => {
  keyboard.height = 336; measurement.height = 25;
  await render('안녕');
  await act(async () => element('chat-input').focus());
  await render('');
  const expandedHeight = element('chat-composer').style.height;
  keyboard.height = 0; await render('');
  expect(parseFloat(element('chat-composer').style.height)).toBeLessThan(parseFloat(expandedHeight));
});

it('sends once from the full-screen button and returns to the mounted bar', async () => {
  await render(); await press('입력창 크게 열기');
  await act(async () => element('expanded-composer-send').click());
  expect(send).toHaveBeenCalledTimes(1);
  expect(element('expanded-composer-surface')).toBeNull();
  expect(element('chat-composer')).not.toBeNull();
});
