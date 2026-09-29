import {useLayoutEffect, useRef} from 'react';
import type {Animated, NativeScrollEvent, NativeSyntheticEvent} from 'react-native';

export interface ScrollChromeTarget {
  registerScroller: (scrollTo: (offset: number) => void) => () => void;
}
export interface ScrollChromeBinding extends ScrollChromeTarget {
  topInset: number;
  animatedTopInset?: Animated.AnimatedInterpolation<number>;
  bottomInset: number;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollBeginDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollBegin: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  reset: () => void;
}

/** Only the active page owns the scroll target; callbacks can use its current list ref. */
export function useScrollChromeTarget(chrome: ScrollChromeTarget | null | undefined, active: boolean, scrollTo: (offset: number) => void) {
  const latest = useRef(scrollTo);
  latest.current = scrollTo;
  const register = chrome?.registerScroller;
  useLayoutEffect(() => {if (active) return register?.(offset => latest.current(offset));}, [active, register]);
}

/** Integrate real scroll distance; clamping excludes the OS overscroll bounce. */
export class ScrollChromeMotion {
  private offset: number | null = null;
  private atTop = true;
  private scrollable = false;
  private maxOffset = 0;
  progress = 1;

  reset() {this.offset = null; this.atTop = true; this.scrollable = false; this.maxOffset = 0; this.progress = 1;}

  capture(offset: number, contentHeight: number, viewportHeight: number) {
    const max = Math.max(0, contentHeight - viewportHeight);
    const y = Math.max(0, Math.min(max, offset));
    this.offset = y;
    this.atTop = y <= 1;
    this.scrollable = max > 1;
    this.maxOffset = max;
  }

  update(offset: number, contentHeight: number, viewportHeight: number, travel: number) {
    const max = Math.max(0, contentHeight - viewportHeight);
    const previous = this.offset === null ? null : Math.min(max, this.offset);
    this.capture(offset, contentHeight, viewportHeight);
    if (!this.scrollable) return this.progress = 1;
    if (previous !== null) this.progress = Math.max(0, Math.min(1, this.progress - (this.offset! - previous) / Math.max(1, travel)));
    return this.progress;
  }

  destination(): 0 | 1 {return !this.scrollable || this.atTop || this.progress >= 0.5 ? 1 : 0;}

  snap(travel: number) {
    const start = this.offset ?? 0, from = this.progress, max = this.maxOffset;
    // Keep the bar open when the list cannot travel far enough to close with it.
    const target = this.destination() === 0 && start + from * travel <= max + 0.5 ? 0 : 1;
    return {target, offsetAt: (progress: number) => Math.max(0, Math.min(max, start + (from - progress) * travel))};
  }
}
