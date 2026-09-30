import {expect, it, vi} from 'vitest';
import {createScrollHeaderAnimation} from '../src/ui/scrollHeaderAnimation';
import {advanceHeaderScroll, type HeaderScrollPosition} from '../src/ui/scrollHeaderMotion';

vi.mock('react-native', () => vi.importActual('react-native-web'));

// Evaluate the actual Animated graph with its JS driver; native QA covers UI-thread delivery.
const value = (node: unknown) => (node as {__getValue: () => number}).__getValue();
// Native callbacks update the source without flushing/evaluating the JS output.
const nativeUpdate = (node: unknown, next: number) =>
  (node as {__onAnimatedValueUpdateReceived: (value: number) => void}).__onAnimatedValueUpdateReceived(next);

it('restores a partly revealed header at a saved scroll offset and follows the next drag', () => {
  const animation = createScrollHeaderAnimation(120, 600, {offset: 400, hidden: 35});
  const stop = animation.observeInputs(vi.fn());
  expect(value(animation.translateY)).toBe(-35);
  nativeUpdate(animation.scrollY, 410);
  expect(value(animation.hidden)).toBe(45);
  nativeUpdate(animation.scrollY, 380);
  expect(value(animation.hidden)).toBe(15);
  nativeUpdate(animation.scrollY, 350);
  expect(value(animation.hidden)).toBe(0);
  stop();
});

it('keeps a release render at the native position after reversing within one drag', () => {
  const animation = createScrollHeaderAnimation(120, 352);
  const stop = animation.observeInputs(vi.fn());
  const writeScroll = vi.spyOn(animation.scrollY, 'setValue');
  nativeUpdate(animation.scrollY, 352);
  expect(value(animation.hidden)).toBe(120);

  // Fully reveal, then partly hide without a React render between the moves.
  for (const offset of [300, 240, 180, 112, 150, 190, 223]) nativeUpdate(animation.scrollY, offset);
  expect(value(animation.hidden)).toBe(111);
  expect(value(animation.translateY)).toBe(-111);
  // Mirroring render state must never send the visual position back through JS.
  expect(writeScroll).not.toHaveBeenCalled();
  stop();
});

it('keeps a release snapshot current through a reversal and a changed scroll range', () => {
  const animation = createScrollHeaderAnimation(120, 500);
  const onScroll = vi.fn();
  const stop = animation.observeInputs(onScroll);
  nativeUpdate(animation.scrollY, 500);
  expect(value(animation.hidden)).toBe(120);
  nativeUpdate(animation.scrollY, 400);
  nativeUpdate(animation.scrollY, 380); // Finish revealing with the content.
  nativeUpdate(animation.scrollY, 600); // Clamp at 500 and hide by 120.
  nativeUpdate(animation.maxOffset, 650); // The new range adds the remaining 100.
  nativeUpdate(animation.scrollY, 560); // Reveal 40 from a fully hidden header.
  expect(value(animation.hidden)).toBe(80);
  expect(value(animation.translateY)).toBe(-80);
  expect(onScroll).toHaveBeenLastCalledWith(560);
  stop();
  expect(animation.scrollY.hasListeners()).toBe(false);
  expect(animation.maxOffset.hasListeners()).toBe(false);
});

it('tracks drag distance and reversals while excluding overscroll from both edges', () => {
  const animation = createScrollHeaderAnimation(120, 500);
  let expected: HeaderScrollPosition = {offset: 0, hidden: 0, height: 120, maxOffset: 500};
  for (const offset of [45, 30, 400, 378, 320, 560, 530, 500, 460, 400, 0, -30, -5, 0, 10]) {
    animation.scrollY.setValue(offset);
    expected = advanceHeaderScroll(expected, offset, 500);
    expect(value(animation.hidden), `offset ${offset}`).toBeCloseTo(expected.hidden);
    expect(value(animation.translateY)).toBeCloseTo(-expected.hidden);
  }
});

it('uses the same movement for content and header throughout a bottom settle and the next drag', () => {
  const animation = createScrollHeaderAnimation(120, 500);
  const stop = animation.observeInputs(vi.fn());
  nativeUpdate(animation.scrollY, 500);
  expect(value(animation.hidden)).toBe(120);
  nativeUpdate(animation.scrollY, 480);
  expect(value(animation.hidden)).toBe(100);
  for (const offset of [483, 491, 497, 500]) {
    nativeUpdate(animation.scrollY, offset);
    expect(value(animation.hidden) - 100).toBe(offset - 480);
  }
  nativeUpdate(animation.scrollY, 420);
  expect(value(animation.hidden)).toBe(40);
  for (const offset of [414, 400, 386, 380]) {
    nativeUpdate(animation.scrollY, offset);
    expect(value(animation.hidden) - 40).toBe(offset - 420);
  }
  stop();
});

it('updates the scroll limit without resetting a partial header and keeps short lists open', () => {
  const animation = createScrollHeaderAnimation(120, 500);
  animation.scrollY.setValue(440);
  expect(value(animation.hidden)).toBe(120);
  animation.scrollY.setValue(370);
  expect(value(animation.hidden)).toBe(50);
  animation.maxOffset.setValue(600);
  expect(value(animation.hidden)).toBe(50);
  animation.scrollY.setValue(350);
  expect(value(animation.hidden)).toBe(30);
  animation.maxOffset.setValue(100);
  expect(value(animation.hidden)).toBe(0);
  animation.scrollY.setValue(150);
  expect(value(animation.hidden)).toBe(0);
  animation.scrollY.setValue(-30);
  expect(value(animation.hidden)).toBe(0);
});

it('starts a new layout or filter with no hidden distance left from the old graph', () => {
  const previous = createScrollHeaderAnimation(120, 500);
  previous.scrollY.setValue(400);
  expect(value(previous.hidden)).toBe(120);
  previous.scrollY.setValue(325);
  expect(value(previous.hidden)).toBe(45);
  const reset = createScrollHeaderAnimation(180, 650);
  expect(value(reset.hidden)).toBe(0);
  reset.scrollY.setValue(20);
  expect(value(reset.hidden)).toBe(20);
});
