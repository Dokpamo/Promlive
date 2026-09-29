// @vitest-environment jsdom
import {act, useState, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import type {ScrollViewProps, ViewProps} from 'react-native';
import {CategoryPager} from '../src/app/CategoryPager';
import {PagingBoundary, usePagingLock} from '../src/layout/PagingBoundary';

const native = vi.hoisted(() => ({scroll: {} as ScrollViewProps, root: {} as ViewProps, width: 400,
  scrollTo: vi.fn(), setNativeProps: vi.fn(), dismissed: vi.fn()}));
vi.mock('react-native', async () => {
  const React = await import('react');
  return {Platform: {OS: 'android'}, Keyboard: {dismiss: native.dismissed}, useWindowDimensions: () => ({width: native.width}),
    ScrollView: React.forwardRef((props: ScrollViewProps, ref) => {
      native.scroll = props;
      React.useImperativeHandle(ref, () => ({scrollTo: native.scrollTo, setNativeProps: native.setNativeProps}));
      return <div>{props.children}</div>;
    }),
    View: (props: ViewProps) => {
      if (props.onStartShouldSetResponderCapture && !props.onTouchStart) native.root = props;
      return <div data-testid={props.testID} aria-hidden={props['aria-hidden']} onTouchStart={props.onTouchStart as never}
        onTouchEnd={props.onTouchEnd as never}>{props.children}</div>;
    },
  };
});
vi.mock('../src/layout/itemListMotion', () => ({useItemReducedMotion: () => false}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(async () => {if (root) await act(async () => root!.unmount()); root = undefined; document.body.replaceChildren(); native.width = 400; vi.clearAllMocks(); vi.useRealTimers();});

function Lock({locked, children}: {locked: boolean; children: ReactNode}) {usePagingLock(locked); return children;}
const changed = vi.fn();
function Host() {
  const [category, setCategory] = useState<string | null>(null);
  const [ids, setIds] = useState<(string | null)[]>([null, 'recent', 'idle', 'mine']);
  const [enabled, setEnabled] = useState(true), [overlay, setOverlay] = useState(false);
  const selected = ids.includes(category) ? category : null;
  return <>
    <button onClick={() => setEnabled(!enabled)}>selection</button>
    <button onClick={() => setOverlay(!overlay)}>overlay</button>
    <button onClick={() => setIds(current => current.filter(id => id !== selected))}>delete category</button>
    <output>{selected ?? 'all'}</output>
    <CategoryPager ids={ids} selected={selected} onSelect={id => {changed(id); setCategory(id);}} enabled={enabled}>{pages => <>
      <Lock locked={overlay}><PagingBoundary>{() => <nav>{ids.map(id => <button key={id ?? 'all'} onClick={() => setCategory(id)}>{id ?? 'all'}</button>)}</nav>}</PagingBoundary></Lock>
      {pages((id, active) => <span data-active={active}>{id ?? 'all'} cards</span>)}
    </>}</CategoryPager>
  </>;
}
async function mount() {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<Host/>));
}
async function press(label: string) {await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === label)!.click());}
const event = (x: number) => ({nativeEvent: {contentOffset: {x, y: 0}}}) as Parameters<NonNullable<ScrollViewProps['onScroll']>>[0];
async function start() {await act(async () => {native.root.onStartShouldSetResponderCapture?.({} as never); native.scroll.onScrollBeginDrag?.(event(0));});}
async function finish(x: number) {await act(async () => {native.scroll.onScroll?.(event(x)); native.scroll.onScrollEndDrag?.(event(x)); native.scroll.onMomentumScrollEnd?.(event(x));});}
const selected = () => document.querySelector('output')!.textContent;

it('pages to adjacent categories in both directions, snaps a short drag back and does not wrap at either end', async () => {
  await mount();
  await start();
  await act(async () => native.scroll.onScroll?.(event(160)));
  expect(selected()).toBe('all');
  await finish(0);
  expect(changed).not.toHaveBeenCalled();
  for (const [x, id] of [[400, 'recent'], [800, 'idle'], [1200, 'mine'], [1600, 'mine'], [800, 'idle'], [400, 'recent'], [0, 'all'], [-400, 'all']] as const) {
    await start(); await finish(x); expect(selected()).toBe(id);
  }
  expect(changed.mock.calls.map(call => call[0])).toEqual(['recent', 'idle', 'mine', 'idle', 'recent', null]);
  expect(document.querySelectorAll('[data-active="true"]')).toHaveLength(1);
});

it('keeps the latest tapped pill authoritative during old scroll completions and realigns after category removal and resize', async () => {
  await mount(); await press('mine');
  expect(native.scrollTo).toHaveBeenLastCalledWith({x: 1200, animated: false});
  await press('recent');
  expect(native.scrollTo).toHaveBeenLastCalledWith({x: 400, animated: true});
  await finish(1200);
  expect(selected()).toBe('recent');
  await finish(400);
  expect(changed).not.toHaveBeenCalled();
  native.width = 600;
  await act(async () => root!.render(<Host/>));
  expect(native.scrollTo).toHaveBeenLastCalledWith({x: 600, animated: true});
  await finish(600); await press('delete category');
  expect(selected()).toBe('all');
  expect(native.scrollTo).toHaveBeenLastCalledWith({x: 0, animated: true});
});

it('locks paging for selection, editors and strip scrolling, then accepts the next body swipe immediately', async () => {
  await mount();
  await press('selection'); expect(native.scroll.scrollEnabled).toBe(false);
  await start(); await finish(400); expect(selected()).toBe('all');
  await press('selection'); await press('overlay'); expect(native.scroll.scrollEnabled).toBe(false);
  await start(); await finish(400); expect(selected()).toBe('all');
  await press('overlay'); expect(native.scroll.scrollEnabled).toBe(true);
  const strip = document.querySelector('nav')!.parentElement!;
  await act(async () => strip.dispatchEvent(new Event('touchstart', {bubbles: true})));
  expect(native.setNativeProps).toHaveBeenLastCalledWith({scrollEnabled: false});
  await act(async () => strip.dispatchEvent(new Event('touchcancel', {bubbles: true})));
  expect(native.scroll.scrollEnabled).toBe(false);
  await start(); expect(native.scroll.scrollEnabled).toBe(true);
  await finish(400); expect(selected()).toBe('recent');
  await start(); await finish(0); expect(selected()).toBe('all');
});

it('settles a drag that ends without momentum', async () => {
  vi.useFakeTimers(); await mount(); await start();
  await act(async () => native.scroll.onScrollEndDrag?.(event(400)));
  await act(async () => vi.advanceTimersByTime(110));
  expect(selected()).toBe('recent');
});

it('ignores the previous momentum ending while a second swipe is already held', async () => {
  await mount(); await start();
  await act(async () => {native.scroll.onScroll?.(event(360)); native.scroll.onScrollEndDrag?.(event(360)); native.scroll.onMomentumScrollBegin?.(event(360));});
  await start();
  await act(async () => native.scroll.onMomentumScrollEnd?.(event(400)));
  expect(selected()).toBe('all');
  await finish(800);
  expect(selected()).toBe('idle');
  expect(native.scrollTo).not.toHaveBeenCalled();
});
