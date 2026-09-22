import {sheetPullDistance, sheetPullLimits, sheetPullOrigin, shouldDismissSheet} from '../settings/sheetMotion';

export function drawerProgress(origin: number, distance: number, width: number) {
  return Math.max(0, Math.min(1, origin + distance / width));
}

/** A deliberate flick wins over distance, including when reversing direction. */
export function shouldOpenDrawer(progress: number, velocity: number) {
  if (Math.abs(velocity) >= 0.45) return velocity > 0;
  return progress >= 0.5;
}

export type NavigationPanel = 'cards' | 'history' | 'pocket';

/** Free axes use the settings sheet's longer pull range, including up and down. */
export function historyDragPosition(distance: {x: number; y: number}, travel: number) {
  return {
    x: distance.x <= 0 ? Math.max(-travel, distance.x) : sheetPullDistance(distance.x, sheetPullLimits.upward),
    y: sheetPullDistance(distance.y, sheetPullLimits.upward),
  };
}

export function historyDragOrigin(position: {x: number; y: number}) {
  return {
    x: position.x <= 0 ? position.x : sheetPullOrigin(position.x, sheetPullLimits.upward),
    y: sheetPullOrigin(position.y, sheetPullLimits.upward),
  };
}

/** Match the settings sheet's release rules, with the exit direction rotated left. */
export function shouldDismissHistory(dx: number, dy: number, vx: number, travel: number) {
  return shouldDismissSheet(dy, -dx, -vx, travel);
}

/** A swipe changes just one level; crossing the chat never opens a second panel. */
export function navigationPanel(state: {cards: number; historyOnTop: boolean; pocket: number; pocketEnabled: boolean}, dx: number): NavigationPanel | null {
  // Use visibility at touch-down, not animation progress: even a popup at its
  // closed edge owns this entire gesture. Retained history behind chat does not.
  if (state.historyOnTop) return 'history';
  if (state.cards > 0) return dx < 0 || state.cards < 1 ? 'cards' : null;
  if (state.pocket > 0) return dx > 0 || state.pocket < 1 ? 'pocket' : null;
  if (dx > 0) return 'cards';
  return state.pocketEnabled ? 'pocket' : null;
}
