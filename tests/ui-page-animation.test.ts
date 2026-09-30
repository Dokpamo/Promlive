import {Animated} from 'react-native';
import {expect, it, vi} from 'vitest';
import {createRootSwipeAnimation} from '../src/ui/rootSwipeAnimation';
import {createBackTransition, createBackUnderlay} from '../src/ui/backTransition';
import {resolveScreenCorners} from '../src/ui/screenCorners';

vi.mock('react-native', () => vi.importActual('react-native-web'));
const value = (node: unknown) => (node as {__getValue: () => number}).__getValue();

it('moves only the body between filters, but the whole page when crossing a tab boundary', () => {
  const source = new Animated.Value(0);
  const translation = source.interpolate({inputRange: [-412, 412], outputRange: [-412, 412], extrapolate: 'clamp'});
  const animation = createRootSwipeAnimation(translation, 412, false, false);
  for (const x of [-60, -240, -90, 120, 0]) {
    source.setValue(x);
    expect(value(animation.pageX)).toBe(0);
    expect(value(animation.bodyX)).toBe(x);
  }
  // On the last filter only the next direction crosses a tab boundary.
  animation.setTabDirections(false, true);
  for (const x of [-250, -50, 0, 180]) {
    source.setValue(x);
    expect(value(animation.pageX)).toBe(Math.min(0, x));
    expect(value(animation.bodyX)).toBe(Math.max(0, x));
  }
  animation.setTabDirections(true, true);
  source.setValue(200);
  expect(value(animation.pageX)).toBe(200);
  expect(value(animation.bodyX)).toBe(0);
});

it('rounds each device corner and brings the previous page from the left with the same back progress', () => {
  const source = new Animated.Value(0);
  const animation = createBackTransition(source, 400, {topLeft: 30, topRight: 31, bottomLeft: 24, bottomRight: 25});
  expect(value(animation.underlayX)).toBe(-120);
  expect(value(animation.dimOpacity)).toBe(0.12);
  expect(value(animation.shadowOpacity)).toBe(0);
  expect(value(animation.corners.borderTopLeftRadius)).toBe(0);
  source.setValue(24);
  expect(value(animation.corners.borderTopLeftRadius)).toBe(15);
  source.setValue(200);
  expect(value(animation.underlayX)).toBe(-60);
  expect(value(animation.dimOpacity)).toBe(0.06);
  expect(value(animation.shadowOpacity)).toBe(1);
  expect(Object.values(animation.corners).map(value)).toEqual([30, 31, 24, 25]);
  source.setValue(400);
  expect(value(animation.underlayX)).toBe(0);
  expect(value(animation.dimOpacity)).toBe(0);
  expect(value(animation.shadowOpacity)).toBe(0);
  // Reversal/cancellation returns both pages; overshooting either end stays bounded.
  source.setValue(100);
  expect(value(animation.underlayX)).toBe(-90);
  expect(value(animation.dimOpacity)).toBe(0.09);
  source.setValue(-40);
  expect(value(animation.underlayX)).toBe(-120);
  expect(value(animation.corners.borderTopLeftRadius)).toBe(0);
  expect(value(animation.shadowOpacity)).toBe(0);
  source.setValue(480);
  expect(value(animation.underlayX)).toBe(0);
});

it('uses actual square corners and falls back only for unavailable or invalid radii', () => {
  expect(resolveScreenCorners({topLeft: 0, topRight: 40, bottomLeft: null, bottomRight: NaN}))
    .toEqual({topLeft: 0, topRight: 40, bottomLeft: 32, bottomRight: 32});
  expect(resolveScreenCorners({topLeft: -1, topRight: Infinity})).toEqual(resolveScreenCorners(null));
});

it('clears both native underlays on immediate back, even with a cancelled or still-moving source', () => {
  const detailX = new Animated.Value(0), editorX = new Animated.Value(0);
  const detail = createBackTransition(detailX, 400, resolveScreenCorners(null));
  const editor = createBackTransition(editorX, 400, resolveScreenCorners(null));
  const underlay = createBackUnderlay(detail, editor, null);
  const attachedX = underlay.translateX, attachedTint = underlay.dimOpacity;
  for (const source of [0, 1, 0, 1] as const) {
    detailX.setValue(0); editorX.setValue(0);
    underlay.select(source);
    expect(value(attachedX)).toBe(-120);
    expect(value(attachedTint)).toBe(0.12);
    const active = source === 0 ? detailX : editorX;
    active.setValue(180);
    expect(value(attachedX)).toBeCloseTo(-66);
    active.setValue(0); // cancelled drag, then toolbar/system back
    (source === 0 ? detail : editor).finish();
    // Even before React reveals the underlay and changes its weight, it is at rest.
    expect(value(attachedX)).toBeCloseTo(0);
    expect(value(attachedTint)).toBe(0);
    underlay.select(null);
    expect(underlay.translateX).toBe(attachedX);
    expect(underlay.dimOpacity).toBe(attachedTint);
    for (const x of [0, 120, 400]) {
      detailX.setValue(x); editorX.setValue(400 - x);
      expect(value(attachedX)).toBeCloseTo(0);
      expect(value(attachedTint)).toBe(0);
    }
  }
});
