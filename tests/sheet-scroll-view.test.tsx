// @vitest-environment jsdom
import {act, type ReactNode, type Ref} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {SheetScrollView} from '../src/layout/SheetScrollView.touch';
import {SheetInputGesture} from '../src/layout/SheetTextInput.touch';
import type {SheetDrag} from '../src/layout/SwipeBackModal';

const native = vi.hoisted(() => ({
  callbacks: {} as Record<string, (...args: any[]) => void>,
  props: [] as {scrollEnabled: boolean}[],
  scrollTo: vi.fn(),
  drag: {canStart: () => true, begin: vi.fn(), move: vi.fn(), release: vi.fn()},
}));
vi.mock('../src/layout/SwipeBackModal', () => ({useSheetDrag: () => native.drag}));
vi.mock('react-native', async () => {
  const React = await import('react');
  return {ScrollView: ({ref, children}: {ref?: Ref<unknown>; children?: ReactNode}) => {
    React.useImperativeHandle(ref, () => ({setNativeProps: (props: {scrollEnabled: boolean}) => native.props.push(props), scrollTo: native.scrollTo}), []);
    return <div>{children}</div>;
  }};
});
vi.mock('react-native-gesture-handler', () => {
  function builder(kind: 'native' | 'pan') {
    const chain: Record<string, (...args: any[]) => unknown> = {};
    for (const name of ['enabled', 'minDistance', 'runOnJS', 'maxPointers', 'shouldCancelWhenOutside', 'simultaneousWithExternalGesture']) chain[name] = () => chain;
    for (const name of ['onBegin', 'onUpdate', 'onFinalize', 'onTouchesDown', 'onTouchesMove']) chain[name] = callback => {native.callbacks[kind === 'native' && name === 'onFinalize' ? 'onNativeFinalize' : name] = callback; return chain;};
    return chain;
  }
  return {Gesture: {Native: () => builder('native'), Pan: () => builder('pan')}, GestureDetector: ({children}: {children: ReactNode}) => children};
});

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
async function render(offset = 100, canStartInputScroll = () => true, horizontalDrag?: SheetDrag, sheetDrag?: SheetDrag | null) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const scroll = {current: {offset, canScroll: true, maxOffset: 300}};
  await act(async () => root!.render(<SheetScrollView sheetScroll={scroll} canStartInputScroll={canStartInputScroll} {...(horizontalDrag ? {horizontalDrag} : {})} {...(sheetDrag !== undefined ? {sheetDrag} : {})}>
    <SheetInputGesture.Consumer>{binding => <span data-testid="input-gesture" data-enabled={binding?.enabled}/>}</SheetInputGesture.Consumer>
  </SheetScrollView>));
  return scroll;
}
function touch(name: string, y: number, extra = {}, success = true) {
  native.callbacks[name]!({absoluteX: 50, absoluteY: y, numberOfPointers: 1, velocityX: 0, velocityY: 600, ...extra}, success);
}
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  document.body.replaceChildren();
  native.props.length = 0;
  vi.clearAllMocks();
});

it('routes horizontal travel to folder navigation without pulling or dismissing the sheet', async () => {
  const folders = {canStart: () => true, begin: vi.fn(), move: vi.fn(), release: vi.fn()};
  await render(0, () => true, folders);
  touch('onBegin', 100);
  touch('onUpdate', 103, {absoluteX: 70});
  touch('onUpdate', 150, {absoluteX: 170}); // Vertical drift keeps the original horizontal owner.
  touch('onFinalize', 150, {absoluteX: 190, velocityX: 800});
  expect(folders.begin).toHaveBeenCalledWith(20, 3, false);
  expect(folders.move).toHaveBeenCalledWith(100, 47);
  expect(folders.release).toHaveBeenCalledWith(120, 47, 0.8, 0.6, false);
  expect(native.drag.begin).not.toHaveBeenCalled();
  expect(native.drag.release).not.toHaveBeenCalled();
  expect(native.props).toEqual([{scrollEnabled: false}, {scrollEnabled: true}]);
});

it('keeps vertical scrolling and the first edge pull with the sheet when folder swipes are enabled', async () => {
  const folders = {canStart: () => true, begin: vi.fn(), move: vi.fn(), release: vi.fn()};
  const scroll = await render(100, () => true, folders);
  touch('onBegin', 100);
  touch('onUpdate', 160);
  scroll.current.offset = 0;
  touch('onUpdate', 250, {absoluteX: 60});
  touch('onUpdate', 270, {absoluteX: 100});
  touch('onFinalize', 270, {absoluteX: 100});
  expect(folders.begin).not.toHaveBeenCalled();
  expect(native.drag.begin).toHaveBeenCalledWith(0, 0, true);
  expect(native.drag.release).toHaveBeenCalledWith(40, 20, 0, 0.6, false);
});

it('does not hand an obscured picker gesture to either navigation or sheet dismissal', async () => {
  const folders = {canStart: () => false, begin: vi.fn(), move: vi.fn(), release: vi.fn()};
  await render(0, () => true, folders);
  touch('onBegin', 100);
  touch('onUpdate', 103, {absoluteX: 70});
  touch('onFinalize', 103, {absoluteX: 200});
  expect(folders.begin).not.toHaveBeenCalled();
  expect(native.drag.begin).not.toHaveBeenCalled();
  expect(native.props).toEqual([]);
});

it('makes the first native edge pull return-only and allows normal pulling on the next gesture', async () => {
  const scroll = await render();
  touch('onBegin', 100);
  touch('onUpdate', 150);
  expect(native.drag.begin).not.toHaveBeenCalled();
  expect(native.props).toEqual([]);
  scroll.current.offset = 0;
  touch('onUpdate', 250);
  touch('onUpdate', 270);
  touch('onFinalize', 270);
  expect(native.drag.begin).toHaveBeenCalledWith(0, 0, true);
  expect(native.drag.move).toHaveBeenCalledWith(0, 20);
  expect(native.drag.release).toHaveBeenCalledWith(0, 20, 0, 0.6, false);
  expect(native.props).toEqual([{scrollEnabled: false}, {scrollEnabled: true}]);
  touch('onBegin', 250);
  touch('onUpdate', 270);
  expect(native.drag.begin).toHaveBeenLastCalledWith(0, 20, undefined);
  expect(native.props.at(-1)).toEqual({scrollEnabled: false});
  touch('onUpdate', 350);
  expect(native.drag.move).toHaveBeenCalledWith(0, 80);
  touch('onFinalize', 400);
  expect(native.drag.release).toHaveBeenCalledWith(0, 130, 0, 0.6, false);
  expect(native.props.at(-1)).toEqual({scrollEnabled: true});
});

it('never moves or closes the sheet for ordinary scrolling and taps', async () => {
  await render();
  touch('onBegin', 300);
  touch('onUpdate', 100);
  touch('onFinalize', 100);
  touch('onBegin', 300);
  touch('onFinalize', 300, {}, false);
  expect(native.drag.begin).not.toHaveBeenCalled();
  expect(native.drag.release).not.toHaveBeenCalled();
  expect(native.props).toEqual([]);
});

it.each([0, 300])('keeps fixed-editor scrolling native at edge %s without falling back to the parent sheet', async edge => {
  await render(edge, () => true, undefined, null);
  for (let repeat = 0; repeat < 2; repeat++) {
    touch('onBegin', 300);
    touch('onUpdate', edge === 0 ? 600 : 50);
    touch('onFinalize', edge === 0 ? 600 : 50);
  }
  expect(native.drag.begin).not.toHaveBeenCalled();
  expect(native.drag.release).not.toHaveBeenCalled();
  expect(native.props).toEqual([]);
});

it.each([{edge: 0, direction: 1}, {edge: 300, direction: -1}])('returns a pull at $edge to scrolling without lifting, even through the opposite edge', async ({edge, direction}) => {
  const scroll = await render();
  touch('onBegin', 400);
  touch('onUpdate', 400 + direction * 50);
  scroll.current.offset = edge;
  touch('onUpdate', 400 + direction * 200);
  touch('onUpdate', 400 + direction * 260);
  expect(native.drag.move).toHaveBeenLastCalledWith(0, direction * 60);
  touch('onUpdate', 400 + direction * 240);
  expect(native.drag.move).toHaveBeenLastCalledWith(0, direction * 40);
  expect(native.scrollTo).not.toHaveBeenCalled();

  // Restore the sheet first; only movement past its origin scrolls the text.
  touch('onUpdate', 400 + direction * 150);
  expect(native.drag.move).toHaveBeenLastCalledWith(0, 0);
  expect(native.scrollTo).toHaveBeenLastCalledWith({y: edge + direction * 50, animated: false});
  expect(scroll.current.offset).toBe(edge + direction * 50);
  // A delayed native scroll report must not become the next drag origin.
  scroll.current.offset = edge;
  touch('onUpdate', 400 + direction * 130);
  expect(native.scrollTo).toHaveBeenLastCalledWith({y: edge + direction * 70, animated: false});

  touch('onUpdate', 400 - direction * 130);
  expect(native.scrollTo).toHaveBeenLastCalledWith({y: 300 - edge, animated: false});
  expect(native.drag.move).toHaveBeenLastCalledWith(0, -direction * 30);
  touch('onFinalize', 400 - direction * 130, {velocityY: -direction * 3000});
  expect(native.drag.begin).toHaveBeenCalledExactlyOnceWith(0, 0, true);
  expect(native.drag.release).toHaveBeenLastCalledWith(0, -direction * 30, 0, -direction * 3, false);
  expect(native.props).toEqual([{scrollEnabled: false}, {scrollEnabled: true}]);
});

it('does not count a return into the contents as permission to dismiss on the next edge arrival', async () => {
  const scroll = await render();
  touch('onBegin', 100);
  touch('onUpdate', 150);
  scroll.current.offset = 0;
  touch('onUpdate', 200);
  touch('onUpdate', 240);
  touch('onUpdate', 150);
  touch('onFinalize', 150);
  expect(scroll.current.offset).toBe(50);
  touch('onBegin', 300);
  touch('onUpdate', 330);
  scroll.current.offset = 0;
  touch('onUpdate', 370);
  expect(native.drag.begin).toHaveBeenLastCalledWith(0, 0, true);
});

it('returns an already scrolled edge pull that was captured away from its original touch point', async () => {
  const scroll = await render(0);
  Object.assign(scroll.current, {hasScrolled: true});
  touch('onBegin', 200);
  touch('onUpdate', 230);
  expect(native.drag.begin).toHaveBeenLastCalledWith(0, 30, true);
  touch('onUpdate', 180);
  expect(native.scrollTo).toHaveBeenLastCalledWith({y: 20, animated: false});
  // Cancel out the captured 30px too, so the sheet actually reaches rest.
  expect(native.drag.move).toHaveBeenLastCalledWith(0, -30);
  touch('onFinalize', 180, {}, false);
  expect(native.drag.release).toHaveBeenLastCalledWith(0, -30, 0, 0.6, true);
  expect(native.props.at(-1)).toEqual({scrollEnabled: true});
});

it('pulls a newly opened list immediately before any internal scrolling', async () => {
  await render(0);
  touch('onBegin', 100);
  touch('onUpdate', 120);
  expect(native.drag.begin).toHaveBeenCalledOnce();
  expect(native.drag.begin).toHaveBeenCalledWith(0, 20, undefined);
  touch('onFinalize', 170);
  expect(native.drag.release).toHaveBeenCalledWith(0, 50, 0, 0.6, false);
});

it('allows an upward sheet pull on the next gesture at the bottom', async () => {
  const scroll = await render();
  touch('onBegin', 300);
  touch('onUpdate', 250);
  scroll.current.offset = 300;
  touch('onUpdate', 100);
  touch('onFinalize', 100);
  expect(native.drag.begin).toHaveBeenCalledWith(0, 0, true);
  touch('onBegin', 300);
  touch('onUpdate', 280);
  expect(native.drag.begin).toHaveBeenLastCalledWith(0, -20, undefined);
  touch('onUpdate', 220);
  expect(native.drag.move).toHaveBeenCalledWith(0, -60);
  touch('onFinalize', 200, {velocityY: -300});
  expect(native.drag.release).toHaveBeenCalledWith(0, -80, 0, -0.3, false);
  expect(native.props.at(-1)).toEqual({scrollEnabled: true});
});

it.each([false, true])('restores scrolling after a cancelled native pull (second finger: %s)', async secondFinger => {
  await render(0);
  touch('onBegin', 100);
  touch('onUpdate', 120);
  if (secondFinger) touch('onUpdate', 140, {numberOfPointers: 2});
  touch('onFinalize', 170, {}, secondFinger);
  expect(native.drag.release).toHaveBeenCalledWith(0, 50, 0, 0.6, true);
  expect(native.props.at(-1)).toEqual({scrollEnabled: true});
});

it.each([false, true])('cancels an editor long press for scrolling, but keeps existing selection (selected: %s)', async selected => {
  await render(100, () => !selected);
  native.callbacks.onTouchesDown!({allTouches: [{absoluteX: 50, absoluteY: 100}], numberOfTouches: 1});
  await act(async () => native.callbacks.onTouchesMove!({allTouches: [{absoluteX: 50, absoluteY: 105}], numberOfTouches: 1}));
  expect(document.querySelector('[data-testid="input-gesture"]')?.getAttribute('data-enabled')).toBe('true');
  await act(async () => native.callbacks.onTouchesMove!({allTouches: [{absoluteX: 50, absoluteY: 150}], numberOfTouches: 1}));
  expect(document.querySelector('[data-testid="input-gesture"]')?.getAttribute('data-enabled')).toBe(String(selected));
  await act(async () => touch('onFinalize', 150));
  expect(document.querySelector('[data-testid="input-gesture"]')?.getAttribute('data-enabled')).toBe('true');
});

it('restores text editing after a fixed-editor scroll without a sheet pan finalizer', async () => {
  await render(100, () => true, undefined, null);
  native.callbacks.onTouchesDown!({allTouches: [{absoluteX: 50, absoluteY: 100}], numberOfTouches: 1});
  await act(async () => native.callbacks.onTouchesMove!({allTouches: [{absoluteX: 50, absoluteY: 150}], numberOfTouches: 1}));
  expect(document.querySelector('[data-testid="input-gesture"]')?.getAttribute('data-enabled')).toBe('false');
  await act(async () => touch('onNativeFinalize', 150));
  expect(document.querySelector('[data-testid="input-gesture"]')?.getAttribute('data-enabled')).toBe('true');
  expect(native.drag.begin).not.toHaveBeenCalled();
});
