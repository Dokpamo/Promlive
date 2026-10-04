import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Easing, Platform} from 'react-native';
import {useReducedMotion} from './useReducedMotion';

export function isBodyTap(start: {x: number; y: number; at: number}, x: number, y: number, at: number) {
  return at - start.at < 280 && Math.hypot(x - start.x, y - start.y) < 8;
}

export function composerScrollOffset(offset: number, content: number, viewport: number, height: number) {
  if (content <= viewport) return 0;
  return Math.max(0, Math.min(height, content - viewport - offset));
}

export function useChatChrome(onTap: () => void, composerHeight: number, headerHeight: number, initialOffset = 0,
  bounds: {hasOlder?: boolean; hasNewer?: boolean} = {}) {
  const [hidden, setHidden] = useState(false), [offscreen, setOffscreen] = useState(false);
  const [headerOffscreen, setHeaderOffscreen] = useState(initialOffset >= headerHeight - 1);
  const controls = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(initialOffset)).current;
  const endOffset = useRef(new Animated.Value(0)).current;
  const lastEnd = useRef(0);
  const geometry = useRef({offset: initialOffset, content: 0, viewport: 0});
  const hideProgress = useMemo(() => {
    // Both controls stay visible in a short conversation, including rubber-band scrolling.
    const scrollable = endOffset.interpolate({inputRange: [0, 0.01], outputRange: [0, 1], extrapolate: 'clamp'});
    return Animated.multiply(Animated.subtract(1, controls), scrollable);
  }, [controls, endOffset]);
  const header = useMemo(() => {
    const fromTop = scrollY.interpolate({inputRange: [0, headerHeight], outputRange: [bounds.hasOlder ? 1 : 0, 1], extrapolate: 'clamp'});
    return Animated.subtract(1, Animated.multiply(hideProgress, fromTop));
  }, [hideProgress, scrollY, headerHeight, bounds.hasOlder]);
  const composerTranslateY = useMemo(() => {
    const distance = Animated.subtract(endOffset, scrollY).interpolate({inputRange: [0, composerHeight],
      outputRange: [0, composerHeight], extrapolate: 'clamp'});
    return Animated.multiply(hideProgress, distance);
  }, [hideProgress, endOffset, scrollY, composerHeight]);
  const updateGeometry = useCallback((offset: number, content: number, viewport: number) => {
    geometry.current = {offset, content, viewport};
    // A paged window edge is not the beginning/end of the conversation.
    const end = Math.max(0, content - viewport) + (bounds.hasNewer ? composerHeight : 0);
    if (lastEnd.current !== end) {lastEnd.current = end; endOffset.setValue(end);}
    setHeaderOffscreen(!!bounds.hasOlder || (end > 0 && offset >= headerHeight - 1));
    setOffscreen(!!bounds.hasNewer || composerScrollOffset(offset, content, viewport, composerHeight) >= composerHeight - 1);
  }, [composerHeight, headerHeight, endOffset, bounds.hasOlder, bounds.hasNewer]);
  useEffect(() => {const g = geometry.current; updateGeometry(g.offset, g.content, g.viewport);}, [updateGeometry]);
  const reduced = useReducedMotion();
  const touch = useRef<{x: number; y: number; at: number} | null>(null);
  useEffect(() => {
    const motion = Animated.timing(controls, {toValue: hidden ? 0 : 1, duration: reduced ? 0 : 180,
      easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web'});
    motion.start(); return () => motion.stop();
  }, [controls, hidden, reduced]);
  const begin = (x: number, y: number) => {touch.current = {x, y, at: Date.now()};};
  const cancel = () => {touch.current = null;};
  const move = (x: number, y: number) => {if (touch.current && Math.hypot(x - touch.current.x, y - touch.current.y) >= 8) cancel();};
  const end = (x: number, y: number) => {
    const start = touch.current; touch.current = null;
    if (start && isBodyTap(start, x, y, Date.now())) {onTap(); setHidden(value => !value);}
  };
  return {hidden, header, headerHidden: hidden && headerOffscreen, scrollY, updateGeometry, composerTranslateY, composerHidden: hidden && offscreen, cancel,
    touchHandlers: Platform.OS === 'web' ? {
      onPointerDown: (e: {nativeEvent: {pageX: number; pageY: number}}) => begin(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPointerUp: (e: {nativeEvent: {pageX: number; pageY: number}}) => end(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPointerMove: (e: {nativeEvent: {pageX: number; pageY: number}}) => move(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPointerCancel: cancel,
    } : {
      onTouchStart: (e: {nativeEvent: {pageX: number; pageY: number; touches: unknown[]}}) => {
        if (e.nativeEvent.touches.length !== 1) cancel(); else begin(e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
      onTouchEnd: (e: {nativeEvent: {pageX: number; pageY: number}}) => end(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onTouchMove: (e: {nativeEvent: {pageX: number; pageY: number}}) => move(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onTouchCancel: cancel,
    },
  };
}
