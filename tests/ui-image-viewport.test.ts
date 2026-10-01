import {expect, it} from 'vitest';
import {clampImage, fitImage, imageAtRest, zoomImageAt} from '../src/ui/imageViewport';

it('fits portrait, square and wide images completely without changing the original ratio', () => {
  expect(fitImage(412, 892, 3 / 4)).toEqual({width: 412, height: 412 * 4 / 3});
  expect(fitImage(412, 892, 1)).toEqual({width: 412, height: 412});
  expect(fitImage(892, 412, 3 / 4)).toEqual({width: 309, height: 412});
  expect(fitImage(412, 892, 2)).toEqual({width: 412, height: 206});
});

it('keeps magnified artwork covering each scrollable axis and recenters when reset', () => {
  const viewport = {width: 400, height: 800}, image = fitImage(400, 800, 3 / 4);
  const panned = clampImage({scale: 2.5, x: 2000, y: -2000}, image, viewport);
  expect(panned.x).toBe(300);
  expect(panned.y).toBeCloseTo(-800 / 3);
  const reset = clampImage({...panned, scale: 1}, image, viewport);
  expect(reset.scale).toBe(1); expect(reset.x).toBeCloseTo(0); expect(reset.y).toBeCloseTo(0);
  expect(clampImage({scale: 100, x: 0, y: 0}, image, viewport).scale).toBe(4);
  const focused = zoomImageAt(imageAtRest, 2, 80, -30);
  // The same image point remains under the focal point after scaling.
  expect(focused.x + 80 * focused.scale).toBe(80);
  expect(focused.y - 30 * focused.scale).toBe(-30);
});
