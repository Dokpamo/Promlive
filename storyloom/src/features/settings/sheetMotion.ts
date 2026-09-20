export interface SheetScrollState {offset: number; canScroll: boolean}

export const sheetPullLimits = {sideways: 16, upward: 72} as const;
const resistance = 0.35;

/** Follow the finger in either direction, with increasing resistance near the limit. */
export function sheetPullDistance(distance: number, limit: number) {
  const resisted = Math.abs(distance) * resistance;
  return Math.sign(distance) * limit * resisted / (limit + resisted);
}

/** Recover the drag origin when grabbing a sheet while it is springing back. */
export function sheetPullOrigin(pull: number, limit: number) {
  const bounded = Math.min(limit - 0.001, Math.abs(pull));
  return Math.sign(pull) * limit * bounded / (resistance * (limit - bounded));
}

export function shouldScrollSheet(scroll: SheetScrollState | undefined, dx: number, dy: number) {
  return !!scroll?.canScroll && Math.abs(dy) > Math.abs(dx) && (dy < 0 || scroll.offset > 1);
}

/** Sideways drags and upward releases always return to the resting position. */
export function shouldDismissSheet(dx: number, dy: number, vy: number, travel: number) {
  return dy > Math.abs(dx) && vy > -0.45 && (dy >= travel * 0.3 || (dy >= 24 && vy >= 0.45));
}
