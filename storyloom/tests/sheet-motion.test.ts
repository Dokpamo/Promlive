import {describe, expect, it} from 'vitest';
import {sheetPullDistance, sheetPullLimits, sheetPullOrigin, shouldDismissSheet, shouldScrollSheet} from '../src/features/settings/sheetMotion';

describe('bottom sheet pulling', () => {
  it('resists pulling and remains bounded during a long drag on either axis', () => {
    for (const limit of Object.values(sheetPullLimits)) {
      expect(sheetPullDistance(0, limit)).toBe(0);
      expect(sheetPullDistance(40, limit)).toBeGreaterThan(0);
      expect(sheetPullDistance(40, limit)).toBeLessThan(40);
      expect(sheetPullDistance(400, limit)).toBeGreaterThan(sheetPullDistance(40, limit));
      expect(sheetPullDistance(4000, limit)).toBeLessThan(limit);
      expect(sheetPullDistance(-4000, limit)).toBeGreaterThan(-limit);
      expect(sheetPullDistance(-40, limit)).toBe(-sheetPullDistance(40, limit));
    }
  });

  it('preserves position when grabbing a returning sheet from either side again', () => {
    for (const limit of Object.values(sheetPullLimits)) {
      for (const distance of [-400, -80, -12, 0, 12, 80, 400]) {
        expect(sheetPullOrigin(sheetPullDistance(distance, limit), limit)).toBeCloseTo(distance);
      }
    }
  });

  it('lets a short sheet follow the finger in all directions', () => {
    for (const [dx, dy] of [[0, -80], [0, 80], [-80, 0], [80, 0], [-80, -80], [80, 80]] as const) {
      expect(shouldScrollSheet({canScroll: false, offset: 0}, dx, dy)).toBe(false);
    }
  });

  it('gives scrolling priority until a long sheet is pulled down at its top', () => {
    expect(shouldScrollSheet({canScroll: true, offset: 120}, 10, 80)).toBe(true);
    expect(shouldScrollSheet({canScroll: true, offset: 0}, 10, -80)).toBe(true);
    expect(shouldScrollSheet({canScroll: true, offset: 0}, 10, 80)).toBe(false);
  });

  it('allows sideways and diagonal sheet drags without starting a vertical scroll', () => {
    for (const [dx, dy] of [[-80, 0], [80, 0], [-80, -30], [80, 30]] as const) {
      expect(shouldScrollSheet({canScroll: true, offset: 120}, dx, dy)).toBe(false);
    }
  });

  it('dismisses with a deliberate downward pull or flick', () => {
    expect(shouldDismissSheet(20, 100, 0, 300)).toBe(true);
    expect(shouldDismissSheet(10, 30, 0.6, 300)).toBe(true);
  });

  it('returns sideways, upward, and mostly sideways diagonal drags instead of closing', () => {
    expect(shouldDismissSheet(160, 0, 0, 300)).toBe(false);
    expect(shouldDismissSheet(0, -100, -1, 300)).toBe(false);
    expect(shouldDismissSheet(-160, 100, 0.6, 300)).toBe(false);
    expect(shouldDismissSheet(160, 100, 0.6, 300)).toBe(false);
  });

  it('returns short pulls and reversals instead of closing', () => {
    expect(shouldDismissSheet(0, 23, 1, 300)).toBe(false);
    expect(shouldDismissSheet(0, 50, 0, 300)).toBe(false);
    expect(shouldDismissSheet(0, 150, -0.6, 300)).toBe(false);
  });
});
