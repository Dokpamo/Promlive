import type {SheetScrollState} from './sheetMotion';

type Point = {x: number; y: number};
type Edge = 'top' | 'bottom';
export type SheetScrollPull = Point & {returnOnly?: boolean};

function edgeAt(scroll?: SheetScrollState): Edge | undefined {
  if (!scroll?.canScroll) return;
  if (scroll.offset <= 1) return 'top';
  if (scroll.maxOffset !== undefined && scroll.offset >= scroll.maxOffset - 1) return 'bottom';
}

/** The first edge pull springs back; only a fresh pull may dismiss a scrolled sheet. */
export function createSheetScrollHandoff() {
  let origin: Point = {x: 0, y: 0};
  let previous = origin;
  let mode: 'pending' | 'scroll' | 'return' | 'pull' = 'pending';
  let armedEdge: Edge | undefined;
  let scrollDirection: Edge | undefined;
  let hasScrolled = false;
  let startedScrollable = false;
  let startingEdge: Edge | undefined;
  return {
    reset(x: number, y: number, scroll?: SheetScrollState) {
      hasScrolled ||= scroll?.hasScrolled === true;
      // A fling may reach the edge after the last move event. It still counts
      // as the first scroll, but only when the next touch starts at that edge.
      if (mode === 'scroll') armedEdge = scrollDirection;
      if (scroll && edgeAt(scroll) !== armedEdge) armedEdge = undefined;
      origin = previous = {x, y};
      mode = 'pending';
      scrollDirection = undefined;
      startedScrollable = scroll?.canScroll === true;
      startingEdge = edgeAt(scroll);
    },
    move(x: number, y: number, scroll?: SheetScrollState): SheetScrollPull | undefined {
      hasScrolled ||= scroll?.hasScrolled === true;
      const stepX = x - previous.x, stepY = y - previous.y;
      previous = {x, y};
      if (mode === 'scroll') {
        if (stepY !== 0) scrollDirection = stepY > 0 ? 'top' : 'bottom';
        if (Math.abs(stepY) > Math.abs(stepX) && edgeAt(scroll) === scrollDirection) {
          // Start at the boundary, excluding all movement used to scroll the list.
          origin = {x, y};
          armedEdge = scrollDirection;
          mode = 'return';
          return {x: 0, y: 0, returnOnly: true};
        }
        return;
      }
      const dx = x - origin.x, dy = y - origin.y;
      if (mode === 'return') return {x: dx, y: dy, returnOnly: true};
      if (Math.hypot(dx, dy) <= 10) return;
      if (mode === 'pending' && scroll?.canScroll && Math.abs(dy) > Math.abs(dx)) {
        const direction: Edge = dy > 0 ? 'top' : 'bottom';
        if (edgeAt(scroll) !== direction || (startedScrollable && startingEdge !== direction)) {
          mode = 'scroll';
          hasScrolled = true;
          scrollDirection = direction;
          armedEdge = undefined;
          if (edgeAt(scroll) === direction) {
            origin = {x, y};
            armedEdge = direction;
            mode = 'return';
            return {x: 0, y: 0, returnOnly: true};
          }
          return;
        }
        if (hasScrolled && armedEdge !== direction) {
          mode = 'return';
          armedEdge = direction;
          return {x: dx, y: dy, returnOnly: true};
        }
      }
      if (mode === 'pending' && (!scroll?.canScroll || Math.abs(dx) >= Math.abs(dy))) armedEdge = undefined;
      mode = 'pull';
      return {x: dx, y: dy};
    },
  };
}
