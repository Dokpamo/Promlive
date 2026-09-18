import {describe, expect, it} from 'vitest';
import {drawerProgress, shouldOpenDrawer} from '../src/features/chat/drawerMotion';

describe('chat drawer gestures', () => {
  it('returns a short slow drag to the page it started from', () => {
    expect(shouldOpenDrawer(drawerProgress(0, 70, 340), 0.1)).toBe(false);
    expect(shouldOpenDrawer(drawerProgress(1, -70, 340), -0.1)).toBe(true);
  });

  it('crosses to the other page after dragging more than halfway', () => {
    expect(shouldOpenDrawer(drawerProgress(0, 220, 340), 0)).toBe(true);
    expect(shouldOpenDrawer(drawerProgress(1, -220, 340), 0)).toBe(false);
  });

  it('follows a deliberate flick, including a reversal before release', () => {
    expect(shouldOpenDrawer(0.15, 0.6)).toBe(true);
    expect(shouldOpenDrawer(0.85, -0.6)).toBe(false);
  });

  it('keeps both screens within their travel bounds', () => {
    expect(drawerProgress(0.5, 900, 340)).toBe(1);
    expect(drawerProgress(0.5, -900, 340)).toBe(0);
  });
});
