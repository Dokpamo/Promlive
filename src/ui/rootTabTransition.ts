import {Animated, Easing, Platform} from 'react-native';
import {animationBatch} from './animationBatch';
import {tabs} from './navigationRoutes';
import type {createRootPageLayout} from './rootPageLayout';
import type {ScreenView} from './screenState';
import {rootPageKey, rootPages, type RootPageKey} from './swipeNavigation';

/** Tab presses move only the painted pages and the destination, one screen apart. */
export function createRootTabTransition(layout: ReturnType<typeof createRootPageLayout>, onMoving: (moving: boolean) => void) {
  const painted = new Set<RootPageKey>();
  let target: ScreenView | null = null, extent = 0, direction = 1, revision = 0, pending = false;
  let animations: Animated.CompositeAnimation[] = [];
  const stop = () => {
    revision++;
    const previous = animations; animations = [];
    previous.forEach(animation => animation.stop());
  };
  const settle = (view: ScreenView, width: number) => {
    animationBatch(() => layout.select(view, width));
    target = null; pending = false; painted.clear(); onMoving(false);
  };
  return {
    isPainted: (key: RootPageKey) => painted.has(key),
    prepare(from: ScreenView, to: ScreenView, width: number) {
      stop();
      if (!target) painted.add(rootPageKey(from));
      direction = tabs.indexOf(to.tab) > tabs.indexOf(from.tab) ? 1 : -1;
      const destination = rootPageKey(to);
      animationBatch(() => {
        // A reversal reuses both live positions. A newly chosen tab starts at
        // the adjacent edge even when it is several tabs away in the tab bar.
        if (!painted.has(destination)) layout.slots[destination].page.setValue(direction * width);
        painted.add(destination);
        for (const {key} of rootPages) {
          const slot = layout.slots[key];
          slot.body.setValue(0); slot.visible.setValue(painted.has(key) ? 1 : 0); slot.header.setValue(1);
        }
      });
      target = to; extent = width; pending = true; onMoving(true);
    },
    sync(view: ScreenView, width: number, enabled: boolean) {
      if (target && enabled && extent === width && rootPageKey(view) === rootPageKey(target)) return;
      stop(); settle(view, width);
    },
    start(reduced: boolean) {
      if (!target || !pending) return;
      pending = false;
      const view = target, width = extent, id = revision;
      if (reduced || width <= 0) {settle(view, width); return;}
      const destination = rootPageKey(view);
      let remaining = painted.size;
      animations = [...painted].map(key => Animated.timing(layout.slots[key].page, {
        toValue: key === destination ? 0 : -direction * width, duration: 210,
        easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS === 'android' || Platform.OS === 'ios',
      }));
      animationBatch(() => animations.forEach(animation => animation.start(({finished}) => {
        if (!finished || id !== revision || --remaining !== 0) return;
        animations = []; settle(view, width);
      })));
    },
    cancel(view: ScreenView, width: number) {stop(); settle(view, width);},
    dispose() {stop(); target = null; painted.clear();},
  };
}
