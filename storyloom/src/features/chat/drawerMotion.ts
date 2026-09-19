export function drawerProgress(origin: number, distance: number, width: number) {
  return Math.max(0, Math.min(1, origin + distance / width));
}

/** A deliberate flick wins over distance, including when reversing direction. */
export function shouldOpenDrawer(progress: number, velocity: number) {
  if (Math.abs(velocity) >= 0.45) return velocity > 0;
  return progress >= 0.5;
}

export type NavigationPanel = 'cards' | 'history' | 'pocket';

/** A swipe changes just one level; crossing the chat never opens a second panel. */
export function navigationPanel(state: {cards: number; history: number; pocket: number; pocketEnabled: boolean}, dx: number): NavigationPanel | null {
  if (state.history > 0) return dx < 0 || state.history < 1 ? 'history' : null;
  if (state.cards > 0) return dx < 0 || state.cards < 1 ? 'cards' : null;
  if (state.pocket > 0) return dx > 0 || state.pocket < 1 ? 'pocket' : null;
  if (dx > 0) return 'cards';
  return state.pocketEnabled ? 'pocket' : null;
}
