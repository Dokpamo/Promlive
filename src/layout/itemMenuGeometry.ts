export interface MenuBounds {left: number; top: number; width: number; height: number}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/** Stay attached to the pressed row; prefer the side nearest the screen's center. */
export function itemMenuGeometry({panel, anchor, viewport, width: requestedWidth, height: requestedHeight, inset, gap}: {
  panel: MenuBounds; anchor: MenuBounds; viewport: MenuBounds;
  width: number; height: number; inset: number; gap: number;
}) {
  const minLeft = Math.max(viewport.left, panel.left) + inset;
  const maxRight = Math.min(viewport.left + viewport.width, panel.left + panel.width) - inset;
  const minTop = Math.max(viewport.top, panel.top) + inset;
  const maxBottom = Math.min(viewport.top + viewport.height, panel.top + panel.height) - inset;
  const width = Math.min(requestedWidth, Math.max(1, maxRight - minLeft));
  const height = Math.min(requestedHeight, Math.max(1, maxBottom - minTop));
  const left = Math.max(minLeft, maxRight - width);
  const anchorTop = clamp(anchor.top, minTop, maxBottom);
  const anchorBottom = clamp(anchor.top + anchor.height, minTop, maxBottom);
  const above = anchorTop - gap - height;
  const below = anchorBottom + gap;
  const centeredTop = viewport.top + (viewport.height - height) / 2;
  const fits = [above, below].filter(top => top >= minTop && top + height <= maxBottom);
  // In short windows, keep the menu reachable and scroll its contents if necessary.
  const candidates = fits.length ? fits : [clamp(above, minTop, maxBottom - height), clamp(below, minTop, maxBottom - height)];
  const top = candidates.reduce((best, value) => Math.abs(value - centeredTop) < Math.abs(best - centeredTop) ? value : best);
  return {
    left, top, width, height,
    originX: clamp(anchor.left + anchor.width / 2 - left, 0, width),
    originY: clamp((anchorTop + anchorBottom) / 2 - top, 0, height),
  };
}
