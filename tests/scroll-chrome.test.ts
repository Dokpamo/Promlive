import {expect, it} from 'vitest';
import {ScrollChromeMotion} from '../src/layout/scrollChrome';

it('follows each scroll distance and settles to the closer endpoint', () => {
  const motion = new ScrollChromeMotion();
  motion.capture(0, 2000, 800);
  expect(motion.update(25, 2000, 800, 100)).toBe(0.75);
  expect(motion.destination()).toBe(1);
  expect(motion.update(60, 2000, 800, 100)).toBeCloseTo(0.4);
  expect(motion.destination()).toBe(0);
  expect(motion.update(300, 2000, 800, 100)).toBe(0);
  expect(motion.update(280, 2000, 800, 100)).toBe(0.2);
  expect(motion.destination()).toBe(0);
  expect(motion.update(240, 2000, 800, 100)).toBeCloseTo(0.6);
  expect(motion.destination()).toBe(1);
  // Reversing during the same drag follows the finger instead of finishing a reveal.
  expect(motion.update(270, 2000, 800, 100)).toBeCloseTo(0.3);
  expect(motion.destination()).toBe(0);
});

it('excludes overscroll bounce and keeps non-scrollable content visible', () => {
  const motion = new ScrollChromeMotion();
  motion.capture(0, 1200, 800);
  motion.update(400, 1200, 800, 100);
  expect(motion.update(465, 1200, 800, 100)).toBe(0);
  expect(motion.update(400, 1200, 800, 100)).toBe(0);
  expect(motion.update(20, 700, 800, 100)).toBe(1);
  expect(motion.destination()).toBe(1);
});

it('resumes from a partial settling position and ignores restored offsets after reset', () => {
  const motion = new ScrollChromeMotion();
  motion.capture(300, 2000, 800);
  motion.progress = 0.35;
  expect(motion.update(280, 2000, 800, 100)).toBeCloseTo(0.55);
  expect(motion.destination()).toBe(1);
  motion.reset();
  motion.capture(500, 2000, 800);
  expect(motion.progress).toBe(1);
  expect(motion.update(520, 2000, 800, 100)).toBe(0.8);
  motion.capture(4, 2000, 800); motion.progress = 0;
  motion.update(0, 2000, 800, 100);
  expect(motion.destination()).toBe(1);
});

it('continues the content by exactly the header snap distance and respects the scroll boundary', () => {
  const motion = new ScrollChromeMotion();
  motion.capture(0, 2000, 800);
  motion.update(60, 2000, 800, 100);
  const closing = motion.snap(100);
  expect(closing.target).toBe(0);
  expect(closing.offsetAt(0.2)).toBe(80);
  expect(closing.offsetAt(0)).toBe(100);
  motion.capture(100, 2000, 800); motion.progress = 0;
  motion.update(40, 2000, 800, 100);
  const opening = motion.snap(100);
  expect(opening.target).toBe(1);
  expect(opening.offsetAt(0.8)).toBeCloseTo(20);
  expect(opening.offsetAt(1)).toBe(0);
  motion.reset(); motion.capture(0, 870, 800);
  motion.update(60, 870, 800, 100);
  const shortList = motion.snap(100);
  expect(shortList.target).toBe(1);
  expect(shortList.offsetAt(1)).toBe(0);
});
