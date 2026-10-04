import {themedStyles} from './Theme';
import {useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref} from 'react';
import {Animated, Platform, StyleSheet, View} from 'react-native';
import type {ScreenView} from './screenState';
import {rootPages, rootPageKey, stepRootView, type RootPageKey, type SwipeDirection} from './swipeNavigation';
import {SwipeContext} from './SwipeSurface';
import {useSwipeMotion} from './useSwipeMotion';
import {createRootSwipeAnimation} from './rootSwipeAnimation';
import {BodyMotionContext, BodyPageContext, type HeaderMotion} from './BodyMotion';
import {createRootPageLayout} from './rootPageLayout';
import {animationBatch} from './animationBatch';
import {createRootTabTransition} from './rootTabTransition';

export type RootPageHandle = {prepare: (next: ScreenView, animateTab?: boolean) => void};

/** Neighboring filter bodies travel together beneath the stationary active header. */
export function TabPages({view, pages, width, enabled, onStep, ref}: {
  view: ScreenView; pages: Record<RootPageKey, ReactNode>; width: number; enabled: boolean;
  onStep: (direction: SwipeDirection) => void;
  ref?: Ref<RootPageHandle>;
}) {
  const styles = useStyles();
  const key = rootPageKey(view);
  const previousView = stepRootView(view, -1), nextView = stepRootView(view, 1);
  const previous = rootPageKey(previousView), next = rootPageKey(nextView);
  const previousIsTab = previousView.tab !== view.tab, nextIsTab = nextView.tab !== view.tab;
  const headers = useRef(new Map<RootPageKey, HeaderMotion>()).current;
  const registerHeader = useCallback((page: RootPageKey, header: HeaderMotion) => {
    headers.set(page, header);
    return () => {if (headers.get(page) === header) headers.delete(page);};
  }, [headers]);
  const [layout] = useState(() => createRootPageLayout(view, width));
  const [tabMoving, setTabMoving] = useState(false);
  const [tabTransition] = useState(() => createRootTabTransition(layout, setTabMoving));
  const currentView = useRef(view); currentView.current = view;
  const motion = useSwipeMotion({identity: key, width, previous: previous !== key, next: next !== key, enabled, onStep,
    prepareReset: () => tabTransition.sync(view, width, enabled)});
  const animation = useMemo(() => createRootSwipeAnimation(motion.translateX, width, previousIsTab, nextIsTab), [motion.translateX, width]);
  useImperativeHandle(ref, () => ({prepare(nextView, animateTab = false) {
    animationBatch(() => {
      motion.cancel();
      if (animateTab && nextView.tab !== currentView.current.tab) tabTransition.prepare(currentView.current, nextView, width);
      else tabTransition.cancel(nextView, width);
    });
    currentView.current = nextView;
    // This runs before notifying React: its next native props must contain the
    // destination coordinates, never stale values from before a layout effect.
  }}), [width, motion.cancel, tabTransition]);
  useLayoutEffect(() => {tabTransition.start(motion.reduceMotion.current);}, [key, tabTransition, motion.reduceMotion]);
  useEffect(() => () => tabTransition.dispose(), [tabTransition]);
  const positions = useMemo(() => {
    // The zero edge keeps visibility attached to the same native-driven graph.
    const zero = Animated.multiply(motion.translateX, 0);
    return Object.fromEntries(rootPages.map(item => {
      const slot = layout.slots[item.key];
      return [item.key, {page: Animated.add(slot.page, animation.pageX), body: Animated.add(slot.body, animation.bodyX),
        visible: Animated.add(slot.visible, zero), header: Animated.add(slot.header, zero)}];
    })) as Record<RootPageKey, {page: Animated.AnimatedAddition<number>; body: Animated.AnimatedAddition<number>;
      visible: Animated.AnimatedAddition<number>; header: Animated.AnimatedAddition<number>}>;
  }, [layout, animation, motion.translateX]);
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
  const gesture = useMemo(() => ({translation: motion.translation, enabled: motion.enabled && !tabMoving,
    onStart: start, onRelease: motion.onRelease}), [motion.translation, motion.enabled, tabMoving, start, motion.onRelease]);
  const bodyMotion = useMemo(() => ({translateX: animation.bodyX, moving: motion.moving || tabMoving, registerHeader}), [animation, motion.moving, tabMoving, registerHeader]);
  return <SwipeContext.Provider value={gesture}><BodyMotionContext.Provider value={bodyMotion}><View style={styles.frame}>
    {rootPages.map(item => {
      const active = item.key === key;
      const neighbor = !active && (item.key === previous || item.key === next);
      const visible = active || (tabMoving ? tabTransition.isPainted(item.key) : neighbor && (Platform.OS !== 'web' || motion.moving));
      const position = positions[item.key];
      return <PageLayer key={item.key} translation={position.page} opacity={position.visible}
        testID={item.key === rootPageKey(view, item.tab) ? `ui-page-${item.tab}` : `ui-prepared-${item.key}`}
        active={active} visible={visible} interactive={active && !motion.settling && !tabMoving}>
        <BodyPageContext.Provider value={{key: item.key, translateX: position.body, headerOpacity: position.header,
          headerVisible: active || item.tab !== view.tab, prepared: active || (enabled && neighbor)}}>{pages[item.key]}</BodyPageContext.Provider>
      </PageLayer>;
    })}
  </View></BodyMotionContext.Provider></SwipeContext.Provider>;
}

/** React owns interaction; the stable native graph owns all painted geometry. */
function PageLayer({translation, opacity, active, visible, interactive, testID, children}: {
  translation: Animated.AnimatedAddition<number>; opacity: Animated.AnimatedAddition<number>; active: boolean; visible: boolean;
  interactive: boolean; testID: string; children: ReactNode;
}) {
  const styles = useStyles();
  return <View testID={testID} aria-hidden={!active} {...(Platform.OS === 'web' ? {inert: !active} : {})}
    accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    pointerEvents={interactive ? 'auto' : 'none'}
    style={[styles.slot, {zIndex: active ? 1 : 0},
      Platform.OS === 'web' && !visible && styles.hidden]}>
    <Animated.View style={[styles.page, {opacity, transform: [{translateX: translation}]}]}>{children}</Animated.View>
  </View>;
}

const useStyles = themedStyles(colors => ({
  frame: {flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: colors.background},
  // The moving page must be able to leave its offscreen slot during a swipe.
  slot: {...StyleSheet.absoluteFillObject, overflow: 'visible'},
  page: {...StyleSheet.absoluteFillObject, overflow: 'hidden'},
  hidden: {display: 'none'},
}));
