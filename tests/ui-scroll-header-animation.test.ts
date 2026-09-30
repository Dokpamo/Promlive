import {expect, it, vi} from 'vitest';
import {createScrollHeaderAnimation} from '../src/ui/scrollHeaderAnimation';
import {advanceHeaderScroll, type HeaderScrollPosition} from '../src/ui/scrollHeaderMotion';

vi.mock('react-native', () => vi.importActual('react-native-web'));

// Evaluate the actual Animated graph with its JS driver; native QA covers UI-thread delivery.
const value = (node: unknown) => (node as {__getValue: () => number}).__getValue();

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

it('can settle only the header and immediately follow the next drag without moving the list', () => {
  const animation = createScrollHeaderAnimation(120, 500);
  animation.scrollY.setValue(500);
  expect(value(animation.hidden)).toBe(120);
  animation.scrollY.setValue(480);
  expect(value(animation.hidden)).toBe(100);
  animation.settleOffset.setValue(20);
  expect(value(animation.hidden)).toBe(120);
  expect(value(animation.scrollY)).toBe(480);
  animation.scrollY.setValue(460);
  expect(value(animation.hidden)).toBe(100);
  animation.settleOffset.setValue(-80);
  expect(value(animation.hidden)).toBe(0);
  expect(value(animation.scrollY)).toBe(460);
  animation.scrollY.setValue(445);
  expect(value(animation.hidden)).toBe(0);
  animation.scrollY.setValue(460);
  expect(value(animation.hidden)).toBe(15);
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
  previous.settleOffset.setValue(-75);
  expect(value(previous.hidden)).toBe(45);
  const reset = createScrollHeaderAnimation(180, 650);
  expect(value(reset.hidden)).toBe(0);
  reset.scrollY.setValue(20);
  expect(value(reset.hidden)).toBe(20);
});
