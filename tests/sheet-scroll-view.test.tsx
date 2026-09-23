// @vitest-environment jsdom
import {act, type ReactNode, type Ref} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {SheetScrollView} from '../src/layout/SheetScrollView.touch';
import {SheetInputGesture} from '../src/layout/SheetTextInput.touch';

const native = vi.hoisted(() => ({
  callbacks: {} as Record<string, (...args: any[]) => void>,
  props: [] as {scrollEnabled: boolean}[],
  drag: {canStart: () => true, begin: vi.fn(), move: vi.fn(), release: vi.fn()},
}));
vi.mock('../src/layout/SwipeBackModal', () => ({useSheetDrag: () => native.drag}));
vi.mock('react-native', async () => {
  const React = await import('react');
  return {ScrollView: ({ref, children}: {ref?: Ref<unknown>; children?: ReactNode}) => {
    React.useImperativeHandle(ref, () => ({setNativeProps: (props: {scrollEnabled: boolean}) => native.props.push(props)}), []);
    return <div>{children}</div>;
  }};
});
vi.mock('react-native-gesture-handler', () => {
  function builder() {
    const chain: Record<string, (...args: any[]) => unknown> = {};
    for (const name of ['minDistance', 'runOnJS', 'maxPointers', 'shouldCancelWhenOutside', 'simultaneousWithExternalGesture']) chain[name] = () => chain;
    for (const name of ['onBegin', 'onUpdate', 'onFinalize', 'onTouchesDown', 'onTouchesMove']) chain[name] = callback => {native.callbacks[name] = callback; return chain;};
    return chain;
  }
  return {Gesture: {Native: builder, Pan: builder}, GestureDetector: ({children}: {children: ReactNode}) => children};
});

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
async function render(offset = 100, canStartInputScroll = () => true) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const scroll = {current: {offset, canScroll: true, maxOffset: 300}};
  await act(async () => root!.render(<SheetScrollView sheetScroll={scroll} canStartInputScroll={canStartInputScroll}>
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
