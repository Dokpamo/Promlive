import {useEffect, useRef, useState} from 'react';
import {Animated, Easing, Platform} from 'react-native';
import {useReducedMotion} from './useReducedMotion';

export function isConversationEnd(offset: number, content: number, viewport: number) {
  return content - viewport - offset <= 3;
}
export function isBodyTap(start: {x: number; y: number; at: number}, x: number, y: number, at: number) {
  return at - start.at < 280 && Math.hypot(x - start.x, y - start.y) < 8;
}

export function useChatChrome(onTap: () => void) {
  const [hidden, setHidden] = useState(false), [atEnd, setAtEnd] = useState(true);
  const header = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const touch = useRef<{x: number; y: number; at: number} | null>(null);
  useEffect(() => {
    const motion = Animated.timing(header, {toValue: hidden ? 0 : 1, duration: reduced ? 0 : 180,
      easing: Easing.out(Easing.cubic), useNativeDriver: false});
    motion.start(); return () => motion.stop();
  }, [header, hidden, reduced]);
  const begin = (x: number, y: number) => {touch.current = {x, y, at: Date.now()};};
  const cancel = () => {touch.current = null;};
  const move = (x: number, y: number) => {if (touch.current && Math.hypot(x - touch.current.x, y - touch.current.y) >= 8) cancel();};
  const end = (x: number, y: number) => {
    const start = touch.current; touch.current = null;
    if (start && isBodyTap(start, x, y, Date.now())) {onTap(); setHidden(value => !value);}
  };
  return {hidden, atEnd, setAtEnd, header, composerHidden: hidden && !atEnd, cancel,
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
