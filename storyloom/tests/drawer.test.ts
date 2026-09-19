import {describe, expect, it} from 'vitest';
import {drawerProgress, navigationPanel, shouldOpenDrawer} from '../src/features/chat/drawerMotion';

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

describe('card history and pocket navigation', () => {
  const chat = {cards: 0, history: 0, pocket: 0, pocketEnabled: true};
  it('opens the card list to the left of chat and the pocket to its right', () => {
    expect(navigationPanel(chat, 80)).toBe('cards');
    expect(navigationPanel(chat, -80)).toBe('pocket');
    expect(navigationPanel({...chat, pocketEnabled: false}, -80)).toBeNull();
  });
  it('closes the card history before closing the outer list', () => {
    expect(navigationPanel({...chat, cards: 1, history: 1}, -80)).toBe('history');
    expect(navigationPanel({...chat, cards: 1, history: 0}, -80)).toBe('cards');
    expect(navigationPanel({...chat, cards: 1, history: 1}, 80)).toBeNull();
  });
  it('returns from the pocket to chat without opening the card list in the same swipe', () => {
    expect(navigationPanel({...chat, pocket: 1}, 80)).toBe('pocket');
    expect(navigationPanel({...chat, pocket: 1}, -80)).toBeNull();
    expect(shouldOpenDrawer(drawerProgress(1, -260, 412), -0.7)).toBe(false);
  });
});
