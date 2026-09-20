import {describe, expect, it} from 'vitest';
import {drawerProgress, historyDragOrigin, historyDragPosition, navigationPanel, shouldDismissHistory, shouldOpenDrawer} from '../src/features/chat/drawerMotion';

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
  const chat = {cards: 0, historyOnTop: false, pocket: 0, pocketEnabled: true};
  it('dismisses history to the left with the same pull and flick thresholds as settings', () => {
    expect(shouldDismissHistory(-130, 15, 0, 360)).toBe(true);
    expect(shouldDismissHistory(-30, 5, -0.6, 360)).toBe(true);
    expect(shouldDismissHistory(-50, 5, 0, 360)).toBe(false);
  });
  it('returns rightward, vertical, diagonal and reversed pulls to the history list', () => {
    expect(shouldDismissHistory(130, 0, 0.8, 360)).toBe(false);
    expect(shouldDismissHistory(0, -130, 0, 360)).toBe(false);
    expect(shouldDismissHistory(-40, 130, -0.6, 360)).toBe(false);
    expect(shouldDismissHistory(-130, 15, 0.6, 360)).toBe(false);
  });
  it('opens the card list to the left of chat and the pocket to its right', () => {
    expect(navigationPanel(chat, 80)).toBe('cards');
    expect(navigationPanel(chat, -80)).toBe('pocket');
    expect(navigationPanel({...chat, pocketEnabled: false}, -80)).toBeNull();
  });
  it('allows equally roomy vertical and rightward pulls while keeping left dismissal direct', () => {
    const right = historyDragPosition({x: 300, y: 0}, 360);
    const down = historyDragPosition({x: 0, y: 300}, 360);
    const up = historyDragPosition({x: 0, y: -300}, 360);
    expect(right.x).toBeGreaterThan(40);
    expect(down.y).toBe(right.x);
    expect(up.y).toBe(-down.y);
    expect(historyDragPosition({x: -130, y: 0}, 360).x).toBe(-130);
    expect(historyDragPosition({x: -900, y: 0}, 360).x).toBe(-360);
  });
  it('can regrab a moving popup without jumping on either axis', () => {
    for (const position of [{x: -140, y: 30}, {x: 30, y: -45}, {x: 0, y: 0}]) {
      const resumed = historyDragPosition(historyDragOrigin(position), 360);
      expect(resumed.x).toBeCloseTo(position.x);
      expect(resumed.y).toBeCloseTo(position.y);
    }
  });
  it('closes the card history before closing the outer list', () => {
    expect(navigationPanel({...chat, cards: 1, historyOnTop: true}, -80)).toBe('history');
    expect(navigationPanel({...chat, cards: 1}, -80)).toBe('cards');
    expect(navigationPanel({...chat, cards: 1, historyOnTop: true}, 80)).toBe('history');
  });
  it('keeps popup gestures off the chat even at either animation edge', () => {
    for (const cards of [0, 0.01, 1]) {
      expect(navigationPanel({...chat, cards, historyOnTop: true}, -400)).toBe('history');
      expect(navigationPanel({...chat, cards, historyOnTop: true}, 200)).toBe('history');
    }
  });
  it('reopens the sidebar with retained history and still lets chat reach its pocket', () => {
    const retainedHistory = {...chat, historyOnTop: false};
    expect(navigationPanel(retainedHistory, 80)).toBe('cards');
    expect(navigationPanel(retainedHistory, -80)).toBe('pocket');
    expect(navigationPanel({...retainedHistory, pocket: 1}, 80)).toBe('pocket');
    expect(navigationPanel({...retainedHistory, cards: 1, historyOnTop: true}, -80)).toBe('history');
  });
  it('returns from the pocket to chat without opening the card list in the same swipe', () => {
    expect(navigationPanel({...chat, pocket: 1}, 80)).toBe('pocket');
    expect(navigationPanel({...chat, pocket: 1}, -80)).toBeNull();
    expect(shouldOpenDrawer(drawerProgress(1, -260, 412), -0.7)).toBe(false);
  });
});
