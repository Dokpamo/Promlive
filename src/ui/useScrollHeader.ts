import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject} from 'react';
import {AccessibilityInfo, Animated, Easing, PanResponder, Platform, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent} from 'react-native';
import {advanceHeaderScroll, headerSettleTarget, type HeaderScrollPosition} from './scrollHeaderMotion';
import {createScrollHeaderAnimation} from './scrollHeaderAnimation';

type ScrollTarget = {scrollToOffset: (options: {offset: number; animated?: boolean}) => void};

/** Keep content overscroll separate from header visibility and its settle animation. */
export function useScrollHeader(list: RefObject<ScrollTarget | null>, initialHeight: number, resetKey: string) {
  const position = useRef<HeaderScrollPosition>({offset: 0, hidden: 0, height: initialHeight, maxOffset: 0});
  const [headerHeight, setHeaderHeight] = useState(initialHeight);
  const measurements = useRef({content: 0, viewport: 0});
  // A new graph discards the accumulated native delta when search/filter/width changes.
  const animation = useMemo(() => createScrollHeaderAnimation(headerHeight,
    Math.max(0, measurements.current.content - measurements.current.viewport)), [headerHeight, resetKey]);
  const settleOffset = useRef(0);
  const touching = useRef(false);
  const dragging = useRef(false);
  const momentum = useRef(false);
  const headerSettling = useRef(false);
  const settleGeneration = useRef(0);
  const reduceMotion = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncSettleOffset = useCallback((value: number) => {
    const delta = value - settleOffset.current;
    settleOffset.current = value;
    const current = position.current;
    current.hidden = current.maxOffset <= current.height ? 0 : Math.max(0, Math.min(current.height, current.hidden + delta));
  }, []);

  useEffect(() => {
    // Only Animated.Value subscribes to native updates; derived-node listeners do not.
    // Mirror the two inputs for endpoint decisions without writing the visual output.
    const scrollListener = animation.scrollY.addListener(({value}) => {
      position.current = advanceHeaderScroll(position.current, value, position.current.maxOffset);
    });
    const settleListener = animation.settleOffset.addListener(({value}) => syncSettleOffset(value));
    return () => {
      animation.scrollY.removeListener(scrollListener);
      animation.settleOffset.removeListener(settleListener);
      animation.settleOffset.stopAnimation();
    };
  }, [animation, syncSettleOffset]);

  const stopHeaderSettle = useCallback(() => {
    if (!headerSettling.current) return;
    headerSettling.current = false;
    settleGeneration.current++;
    animation.settleOffset.stopAnimation(syncSettleOffset);
  }, [animation, syncSettleOffset]);

  const cancelSnap = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const scheduleSnap = useCallback((delay = 120) => {
    cancelSnap();
    timer.current = setTimeout(() => {
      timer.current = null;
      if (touching.current || dragging.current || momentum.current) return;
      const target = headerSettleTarget(position.current);
      if (target?.kind === 'scroll') list.current?.scrollToOffset({offset: target.offset, animated: !reduceMotion.current});
      else if (target?.kind === 'header') {
        headerSettling.current = true;
        const generation = ++settleGeneration.current;
        const toValue = settleOffset.current + target.hidden - position.current.hidden;
        Animated.timing(animation.settleOffset, {toValue,
          duration: reduceMotion.current ? 0 : 180, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web'}).start(({finished}) => {
            if (generation !== settleGeneration.current) return;
            if (finished) {position.current.hidden = target.hidden; settleOffset.current = toValue;}
            headerSettling.current = false;
          });
      }
    }, delay);
  }, [animation, cancelSnap, list]);

  const reset = useCallback(() => {
    cancelSnap();
    headerSettling.current = false;
    settleGeneration.current++;
    settleOffset.current = 0;
    const wasScrolled = position.current.offset !== 0;
    position.current = {...position.current, offset: 0, hidden: 0, height: headerHeight};
    touching.current = dragging.current = momentum.current = false;
    if (wasScrolled) list.current?.scrollToOffset({offset: 0, animated: false});
  }, [animation, cancelSnap, headerHeight, list]);

  const updateRange = useCallback(() => {
    const maxOffset = Math.max(0, measurements.current.content - measurements.current.viewport);
    if (position.current.maxOffset === maxOffset) return;
    position.current.maxOffset = maxOffset;
    animation.maxOffset.setValue(maxOffset);
  }, [animation]);

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
  }, []);

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
    touching.current = true;
    cancelSnap();
    stopHeaderSettle();
  }, [cancelSnap, stopHeaderSettle]);

  const endTouch = useCallback(() => {touching.current = false; scheduleSnap();}, [scheduleSnap]);
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
    onHeaderLayout,
    headerHeight,
    headerStyle: {transform: [{translateY: animation.translateY}]},
    headerGestureProps: {...headerPan.panHandlers, onTouchStart: beginTouch, onTouchEnd: endTouch, onTouchCancel: endTouch},
    scrollProps: {
      bounces: true,
      alwaysBounceVertical: false,
      overScrollMode: 'auto' as const,
      onLayout: (event: LayoutChangeEvent) => {measurements.current.viewport = event.nativeEvent.layout.height; updateRange();},
      onContentSizeChange: (_width: number, height: number) => {measurements.current.content = height; updateRange();},
      onScroll,
      onTouchStart: beginTouch,
      onTouchEnd: endTouch,
      onTouchCancel: endTouch,
      onScrollBeginDrag: () => {dragging.current = true; momentum.current = false; cancelSnap(); stopHeaderSettle();},
      onScrollEndDrag: () => {dragging.current = false; scheduleSnap();},
      onMomentumScrollBegin: () => {momentum.current = true; cancelSnap();},
      onMomentumScrollEnd: () => {momentum.current = false; scheduleSnap(40);},
    },
  };
}
