import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject} from 'react';
import {AccessibilityInfo, Animated, PanResponder, Platform, useWindowDimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent} from 'react-native';
import {advanceHeaderScroll, headerSettleTarget, type HeaderScrollPosition} from './scrollHeaderMotion';
import {createScrollHeaderAnimation} from './scrollHeaderAnimation';
import type {ScreenMemoryController as ScreenMemory} from './ScreenMemory';
import {emptyScrollMemory, type ScrollScope} from './screenState';
import {useTabBarContentInset} from './tabBarLayout';

type ScrollTarget = {scrollToOffset: (options: {offset: number; animated?: boolean}) => void};
type Paging = {hasMore: boolean; loading?: boolean; loadMore?: (() => Promise<void>) | undefined};

/** Keep content overscroll separate from header visibility and its settle animation. */
export function useScrollHeader(list: RefObject<ScrollTarget | null>, initialHeight: number, resetKey: string, memory?: ScreenMemory, scope?: ScrollScope, paging?: Paging) {
  const page = useRef(paging); page.current = paging;
  const bottomInset = useTabBarContentInset();
  const saved = useRef(memory && scope ? memory.getScroll(scope) : emptyScrollMemory).current;
  const {height: windowHeight} = useWindowDimensions();
  const position = useRef<HeaderScrollPosition>({...saved, height: saved.height || initialHeight,
    maxOffset: saved.hidden > 0 ? Math.max(saved.maxOffset, (saved.height || initialHeight) + 1) : saved.maxOffset});
  const [headerHeight, setHeaderHeight] = useState(saved.height || initialHeight);
  const [adoption, setAdoption] = useState(0);
  // Preserve a short list's inherited collapse on cold start, before native layout arrives.
  const [minimumContentHeight, setMinimumContentHeight] = useState(() => saved.hidden > 0
    ? windowHeight + (saved.height || initialHeight) + 1 : 0);
  const pendingAdoption = useRef<number | null>(null);
  const measurements = useRef({content: 0, viewport: 0});
  const previousKey = useRef(resetKey);
  const restorePending = useRef(saved.offset > 0), requestedHeight = useRef(-1);
  const contentOffset = useRef({x: 0, y: saved.offset}).current;
  // A new graph discards the accumulated native delta when search/filter/width changes.
  const animation = useMemo(() => createScrollHeaderAnimation(headerHeight, position.current.maxOffset,
    previousKey.current === resetKey ? position.current : {offset: 0, hidden: 0}), [headerHeight, resetKey, adoption]);
  const touching = useRef(false);
  const dragging = useRef(false);
  const momentum = useRef(false);
  const horizontalGesture = useRef(false);
  const reduceMotion = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remember = useCallback(() => {if (memory && scope) memory.rememberScroll(scope, position.current);}, [memory, scope]);

  useEffect(() => {
    // Only Animated.Value subscribes to native updates; derived-node listeners do not.
    // Observe scroll distance for endpoint decisions without writing the visual output.
    return animation.observeInputs(value => {
      position.current = advanceHeaderScroll(position.current, value, position.current.maxOffset);
      if (!restorePending.current) remember();
    });
  }, [animation, remember]);

  const cancelSnap = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const scheduleSnap = useCallback((delay = 120) => {
    cancelSnap();
    timer.current = setTimeout(() => {
      timer.current = null;
      if (touching.current || dragging.current || momentum.current || horizontalGesture.current) return;
      const target = headerSettleTarget(position.current);
      if (target) list.current?.scrollToOffset({offset: target.offset, animated: !reduceMotion.current});
    }, delay);
  }, [cancelSnap, list]);

  const holdForHorizontalGesture = useCallback((active: boolean) => {
    horizontalGesture.current = active;
    if (active) cancelSnap();
  }, [cancelSnap]);

  const readHidden = useCallback(() => position.current.maxOffset > position.current.height ? position.current.hidden : 0, []);
  const adoptHidden = useCallback((hidden: number) => {
    cancelSnap();
    const nextHidden = Math.max(0, Math.min(position.current.height, hidden));
    if (Math.abs(nextHidden - position.current.hidden) < 0.5 && (nextHidden === 0 || position.current.maxOffset > position.current.height)) return;
    // A short destination needs enough scroll range to pull the preserved header back down.
    if (nextHidden > 0 && position.current.maxOffset <= position.current.height) {
      position.current.maxOffset = position.current.height + 1;
      setMinimumContentHeight(measurements.current.viewport + position.current.height + 1);
    }
    const offset = Math.max(position.current.offset, nextHidden);
    position.current = {...position.current, offset, hidden: nextHidden};
    restorePending.current = false;
    pendingAdoption.current = offset;
    setAdoption(value => value + 1);
    remember();
  }, [cancelSnap, remember]);

  useLayoutEffect(() => {
    if (pendingAdoption.current === null) return;
    const frame = requestAnimationFrame(() => {
      const offset = pendingAdoption.current;
      pendingAdoption.current = null;
      if (offset !== null) list.current?.scrollToOffset({offset, animated: false});
    });
    return () => cancelAnimationFrame(frame);
  }, [adoption, list]);

  const reset = useCallback(() => {
    cancelSnap();
    if (previousKey.current === resetKey) return;
    previousKey.current = resetKey;
    pendingAdoption.current = null;
    setMinimumContentHeight(0);
    restorePending.current = false;
    const wasScrolled = position.current.offset !== 0;
    position.current = {...position.current, offset: 0, hidden: 0, height: headerHeight};
    touching.current = dragging.current = momentum.current = false;
    if (wasScrolled) list.current?.scrollToOffset({offset: 0, animated: false});
    remember();
  }, [animation, cancelSnap, headerHeight, list, remember, resetKey]);

  const updateRange = useCallback(() => {
    if (measurements.current.content <= 0 || measurements.current.viewport <= 0) return;
    const requiredHeight = minimumContentHeight > 0 ? measurements.current.viewport + position.current.height + 1 : 0;
    const maxOffset = Math.max(0, Math.max(measurements.current.content, requiredHeight) - measurements.current.viewport);
    if (position.current.maxOffset !== maxOffset) {
      position.current.maxOffset = maxOffset;
      animation.maxOffset.setValue(maxOffset);
    }
    if (restorePending.current) {
      list.current?.scrollToOffset({offset: Math.min(saved.offset, maxOffset), animated: false});
      if (saved.offset > maxOffset && page.current?.hasMore && page.current.loadMore) {
        if (requestedHeight.current !== measurements.current.content) {requestedHeight.current = measurements.current.content; void page.current.loadMore();}
        return;
      }
      restorePending.current = false;
    }
    remember();
  }, [animation, list, remember, saved.offset, minimumContentHeight]);
  useEffect(() => {if (restorePending.current && !paging?.loading) {
    const frame = requestAnimationFrame(updateRange); return () => cancelAnimationFrame(frame);
  }}, [paging?.hasMore, paging?.loading, updateRange]);

  useLayoutEffect(reset, [reset, resetKey]);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {if (mounted) reduceMotion.current = value;});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {reduceMotion.current = value;});
    return () => {mounted = false; subscription?.remove(); cancelSnap();};
  }, [cancelSnap]);

  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (height <= 0 || Math.abs(height - position.current.height) < 0.5) return;
    position.current.height = height;
    setHeaderHeight(height);
    if (!restorePending.current) remember();
  }, [remember]);

  const observeScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const {contentSize, layoutMeasurement} = event.nativeEvent;
    measurements.current = {content: contentSize.height, viewport: layoutMeasurement.height};
    updateRange();
    // Never write the header transform here: it already moved with this native event.
    // Also handles wheel/trackpad scrolling, which has no native drag/momentum events.
    if (!touching.current && !dragging.current && !momentum.current) scheduleSnap();
  }, [scheduleSnap, updateRange]);

  const onScroll = useMemo(() => Animated.event([{nativeEvent: {contentOffset: {y: animation.scrollY}}}], {
    useNativeDriver: Platform.OS !== 'web', listener: observeScroll,
  }), [animation, observeScroll]);

  const beginTouch = useCallback(() => {
    restorePending.current = false;
    touching.current = true;
    cancelSnap();
  }, [cancelSnap]);

  const endTouch = useCallback(() => {touching.current = false; scheduleSnap(); remember();}, [scheduleSnap, remember]);
  const headerDragOrigin = useRef(0);
  const headerPan = useMemo(() => PanResponder.create({
    // Leave taps and horizontal filter gestures with the header's controls.
    onMoveShouldSetPanResponderCapture: (_event, gesture) => gesture.numberActiveTouches === 1
      && Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.4,
    onPanResponderGrant: () => {
      beginTouch();
      dragging.current = true;
      momentum.current = false;
      headerDragOrigin.current = position.current.offset;
      list.current?.scrollToOffset({offset: position.current.offset, animated: false});
    },
    onPanResponderMove: (_event, gesture) => {
      const offset = Math.max(0, Math.min(position.current.maxOffset, headerDragOrigin.current - gesture.dy));
      list.current?.scrollToOffset({offset, animated: false});
    },
    onPanResponderRelease: () => {dragging.current = false; endTouch();},
    onPanResponderTerminate: () => {dragging.current = false; endTouch();},
    onPanResponderTerminationRequest: () => true,
  }), [beginTouch, endTouch, list]);

  return {
    holdForHorizontalGesture,
    readHidden, adoptHidden,
    minimumContentStyle: minimumContentHeight > 0 || bottomInset > 0
      ? {...(minimumContentHeight > 0 ? {minHeight: minimumContentHeight} : {}), ...(bottomInset > 0 ? {paddingBottom: bottomInset} : {})} : undefined,
    onHeaderLayout,
    headerHeight,
    headerStyle: {transform: [{translateY: animation.translateY}]},
    headerGestureProps: {...headerPan.panHandlers, onTouchStart: beginTouch, onTouchEnd: endTouch, onTouchCancel: endTouch},
    scrollProps: {
      contentOffset,
      contentInsetAdjustmentBehavior: 'never' as const,
      automaticallyAdjustContentInsets: false,
      maintainVisibleContentPosition: {minIndexForVisible: 1},
      bounces: true,
      alwaysBounceVertical: false,
      overScrollMode: 'auto' as const,
      onLayout: (event: LayoutChangeEvent) => {
        measurements.current.viewport = event.nativeEvent.layout.height;
        if (minimumContentHeight > 0) setMinimumContentHeight(measurements.current.viewport + headerHeight + 1);
        updateRange();
      },
      onContentSizeChange: (_width: number, height: number) => {measurements.current.content = height; updateRange();},
      onScroll,
      onTouchStart: beginTouch,
      onTouchEnd: endTouch,
      onTouchCancel: endTouch,
      onScrollBeginDrag: () => {dragging.current = true; momentum.current = false; cancelSnap();},
      onScrollEndDrag: () => {dragging.current = false; scheduleSnap();},
      onMomentumScrollBegin: () => {momentum.current = true; cancelSnap();},
      onMomentumScrollEnd: () => {momentum.current = false; scheduleSnap(40);},
    },
  };
}
