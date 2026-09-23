import {expect, it} from 'vitest';
import {constrainPhotoCrop, initialPhotoCrop, movePhotoCrop, photoCropRect, zoomPhotoCrop} from '../src/features/profile/photoCrop';

const portrait = {uri: 'file:///photo.jpg', width: 800, height: 1200};

it('starts centered while retaining the whole source for later repositioning', () => {
  expect(photoCropRect(portrait, 320, initialPhotoCrop)).toEqual({x: 0, y: 200, size: 800});
  expect(photoCropRect({...portrait, width: 1200, height: 800}, 320, initialPhotoCrop)).toEqual({x: 200, y: 0, size: 800});
});

it('keeps every saved crop inside portrait, landscape, and square sources at every zoom', () => {
  for (const [width, height] of [[800, 1200], [1200, 800], [100, 100], [2048, 113]]) {
    const photo = {...portrait, width: width!, height: height!};
    for (const zoom of [0.1, 1, 1.25, 2, 4, 10]) for (const x of [-10000, 0, 10000]) for (const y of [-10000, 0, 10000]) {
      const crop = photoCropRect(photo, 320, {zoom, x, y});
      expect(crop.x).toBeGreaterThanOrEqual(0); expect(crop.y).toBeGreaterThanOrEqual(0);
      expect(crop.x + crop.size).toBeLessThanOrEqual(photo.width);
      expect(crop.y + crop.size).toBeLessThanOrEqual(photo.height);
    }
  }
});

it('moves the photo under a stationary circle and exports that same region', () => {
  const crop = movePhotoCrop(portrait, 320, initialPhotoCrop, {x: 0, y: 0, count: 1, distance: 0}, {x: 50, y: 60, count: 1, distance: 0});
  expect(crop).toEqual({zoom: 1, x: 0, y: 60});
  expect(photoCropRect(portrait, 320, crop)).toEqual({x: 0, y: 50, size: 800});
});

it('anchors a pinch to its moving midpoint and continues a one-finger drag without a jump', () => {
  const pinch = movePhotoCrop(portrait, 320, initialPhotoCrop, {x: 30, y: 20, count: 2, distance: 100}, {x: 45, y: 20, count: 2, distance: 200});
  expect(pinch).toEqual({zoom: 2, x: -15, y: -20});
  const remainingFinger = {x: 80, y: 20, count: 1, distance: 0};
  expect(movePhotoCrop(portrait, 320, pinch, remainingFinger, remainingFinger)).toEqual(pinch);
  expect(movePhotoCrop(portrait, 320, pinch, remainingFinger, {...remainingFinger, x: 100})).toEqual({...pinch, x: 5});
});

it('clamps after zooming out so the circle cannot reveal empty space', () => {
  const farEdge = constrainPhotoCrop(portrait, 320, {zoom: 4, x: 1000, y: 1000});
  expect(zoomPhotoCrop(portrait, 320, farEdge, 0.5)).toEqual({zoom: 1, x: 0, y: 80});
});
