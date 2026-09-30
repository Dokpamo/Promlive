import {useCallback, useLayoutEffect, useMemo, useRef, type ReactNode} from 'react';
import {Animated, Platform, StyleSheet, View} from 'react-native';
import type {ScreenView} from './screenState';
import {rootPages, rootPageKey, stepRootView, type RootPageKey, type SwipeDirection} from './swipeNavigation';
import {SwipeContext} from './SwipeSurface';
import {useSwipeMotion} from './useSwipeMotion';
import {createRootSwipeAnimation} from './rootSwipeAnimation';
import {BodyMotionContext, BodyPageContext, type HeaderMotion} from './BodyMotion';
import {colors} from './tokens';

/** Neighboring filter bodies travel together beneath the stationary active header. */
export function TabPages({view, pages, width, enabled, onStep}: {
  view: ScreenView; pages: Record<RootPageKey, ReactNode>; width: number; enabled: boolean;
  onStep: (direction: SwipeDirection) => void;
}) {
  const key = rootPageKey(view);
  const previousView = stepRootView(view, -1), nextView = stepRootView(view, 1);
  const previous = rootPageKey(previousView), next = rootPageKey(nextView);
  const previousIsTab = previousView.tab !== view.tab, nextIsTab = nextView.tab !== view.tab;
  const headers = useRef(new Map<RootPageKey, HeaderMotion>()).current;
  const registerHeader = useCallback((page: RootPageKey, header: HeaderMotion) => {
    headers.set(page, header);
    return () => {if (headers.get(page) === header) headers.delete(page);};
  }, [headers]);
  const motion = useSwipeMotion({identity: key, width, previous: previous !== key, next: next !== key, enabled, onStep});
  const animation = useMemo(() => createRootSwipeAnimation(motion.translateX, width, previousIsTab, nextIsTab), [motion.translateX, width]);
  useLayoutEffect(() => {animation.setTabDirections(previousIsTab, nextIsTab);}, [animation, previousIsTab, nextIsTab]);
  const start = useCallback(() => {
    const hidden = headers.get(key)?.readHidden();
    // Prepare the destination while it is still offscreen, so arrival cannot reopen the header.
    if (hidden !== undefined) {
      if (previous !== key && !previousIsTab) headers.get(previous)?.adoptHidden(hidden);
      if (next !== key && !nextIsTab) headers.get(next)?.adoptHidden(hidden);
    }
    motion.onStart();
  }, [headers, key, previous, next, previousIsTab, nextIsTab, motion.onStart]);
  const gesture = useMemo(() => ({translation: motion.translation, enabled: motion.enabled,
    onStart: start, onRelease: motion.onRelease}), [motion.translation, motion.enabled, start, motion.onRelease]);
  const bodyMotion = useMemo(() => ({translateX: animation.bodyX, moving: motion.moving, registerHeader}), [animation, motion.moving, registerHeader]);
  return <SwipeContext.Provider value={gesture}><BodyMotionContext.Provider value={bodyMotion}><View style={styles.frame}>
    {rootPages.map(item => {
      const active = item.key === key;
      const neighbor = !active && (item.key === previous || item.key === next);
      const filterNeighbor = neighbor && item.tab === view.tab;
      const visible = active || (neighbor && (Platform.OS !== 'web' || motion.moving));
      const adjacentOffset = item.key === previous ? -width : width;
      const offset = active || filterNeighbor ? 0 : adjacentOffset;
      return <PageLayer key={item.key} offset={offset} translation={animation.pageX}
        testID={item.key === rootPageKey(view, item.tab) ? `ui-page-${item.tab}` : `ui-prepared-${item.key}`}
        active={active} visible={visible} interactive={active && !motion.settling}>
        <BodyPageContext.Provider value={{key: item.key, offset: filterNeighbor ? adjacentOffset : 0,
          headerVisible: active || item.tab !== view.tab}}>{pages[item.key]}</BodyPageContext.Provider>
      </PageLayer>;
    })}
  </View></BodyMotionContext.Provider></SwipeContext.Provider>;
}

/** Keep each view attached to one native graph; move its base instead of swapping graphs. */
function PageLayer({offset, translation, active, visible, interactive, testID, children}: {
  offset: number; translation: Animated.AnimatedAddition<number>; active: boolean; visible: boolean;
  interactive: boolean; testID: string; children: ReactNode;
}) {
  const base = useRef(new Animated.Value(offset)).current;
  const translateX = useMemo(() => Animated.add(translation, base), [translation, base]);
  useLayoutEffect(() => {base.setValue(offset);}, [base, offset]);
  return <Animated.View testID={testID} aria-hidden={!active} {...(Platform.OS === 'web' ? {inert: !active} : {})}
    accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    pointerEvents={interactive ? 'auto' : 'none'}
    style={[styles.page, {opacity: visible ? 1 : 0, zIndex: active ? 1 : 0, transform: [{translateX}]},
      Platform.OS === 'web' && !visible && styles.hidden]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  frame: {flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: colors.background},
  page: {...StyleSheet.absoluteFillObject, overflow: 'hidden'},
  hidden: {display: 'none'},
});
