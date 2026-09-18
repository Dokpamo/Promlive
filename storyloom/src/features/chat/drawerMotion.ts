export function drawerProgress(origin: number, distance: number, width: number) {
  return Math.max(0, Math.min(1, origin + distance / width));
}

/** A deliberate flick wins over distance, including when reversing direction. */
export function shouldOpenDrawer(progress: number, velocity: number) {
  if (Math.abs(velocity) >= 0.45) return velocity > 0;
  return progress >= 0.5;
}
