export interface MenuBounds {left: number; top: number; width: number; height: number}
export interface MenuPoint {x: number; y: number}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/** Follow the press horizontally, keeping the menu above or below the entire target row. */
export function itemMenuGeometry({panel, anchor, point, viewport, width: requestedWidth, height: requestedHeight, inset, gap}: {
  panel: MenuBounds; anchor: MenuBounds; point?: MenuPoint; viewport: MenuBounds;
  width: number; height: number; inset: number; gap: number;
}) {
  const minLeft = Math.max(viewport.left, panel.left) + inset;
  const maxRight = Math.min(viewport.left + viewport.width, panel.left + panel.width) - inset;
  const minTop = Math.max(viewport.top, panel.top) + inset;
  const maxBottom = Math.min(viewport.top + viewport.height, panel.top + panel.height) - inset;
  const width = Math.min(requestedWidth, Math.max(1, maxRight - minLeft));
  const x = point?.x ?? anchor.left + anchor.width / 2;
  const left = clamp(x - width / 2, minLeft, maxRight - width);
  const anchorTop = clamp(anchor.top, minTop, maxBottom);
  const anchorBottom = clamp(anchor.top + anchor.height, minTop, maxBottom);
  // If neither side fits the whole menu, scroll within the larger free area
  // instead of shifting the menu over the pressed item.
  const availableHeight = Math.max(1, anchorTop - gap - minTop, maxBottom - anchorBottom - gap);
  const height = Math.min(requestedHeight, availableHeight);
  const above = anchorTop - gap - height;
  const below = anchorBottom + gap;
  const centeredTop = viewport.top + (viewport.height - height) / 2;
  const fits = [above, below].filter(top => top >= minTop && top + height <= maxBottom);
  // Retain a bounded fallback when a transient layout leaves no space on either side.
  const candidates = fits.length ? fits : [clamp(above, minTop, maxBottom - height), clamp(below, minTop, maxBottom - height)];
  const top = candidates.reduce((best, value) => Math.abs(value - centeredTop) < Math.abs(best - centeredTop) ? value : best);
  return {
    left, top, width, height,
    originX: clamp(x - left, 0, width),
    originY: clamp((anchorTop + anchorBottom) / 2 - top, 0, height),
  };
}
