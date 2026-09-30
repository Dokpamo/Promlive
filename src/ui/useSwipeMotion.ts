import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, Easing, Keyboard, Platform} from 'react-native';
import {swipeDestination, type SwipeDirection} from './swipeNavigation';
import {pageSpring, type BackTransition} from './backTransition';

export function useSwipeMotion({identity, width, previous, next, enabled = true, onStep, source, release = 'slide', entrance}: {
  identity: string; width: number; previous: boolean; next: boolean; enabled?: boolean;
  onStep: (direction: SwipeDirection) => void;
  source?: Animated.Value;
  release?: 'slide' | 'back';
  entrance?: BackTransition;
}) {
  const localTranslation = useRef(new Animated.Value(0)).current;
  const translation = source ?? localTranslation;
  const [moving, setMoving] = useState(false);
  const [settling, setSettling] = useState(false);
  const revision = useRef(0);
  const reduceMotion = useRef(false);
  const entry = useRef(entrance); entry.current = entrance;
  const current = useRef({width, previous, next, onStep}); current.current = {width, previous, next, onStep};
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {if (alive) reduceMotion.current = value;});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {reduceMotion.current = value;});
    return () => {alive = false; listener?.remove();};
  }, []);
  useLayoutEffect(() => {
    const id = ++revision.current;
    const opening = entry.current;
    translation.stopAnimation();
    setMoving(false); setSettling(false);
    if (enabled && opening?.isOpening()) {
      translation.setValue(width);
      setSettling(true);
      // Respect Reduce Motion before starting; the previous screen stays painted.
      void AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then(reduced => {
        if (id !== revision.current) return;
        reduceMotion.current = reduced;
        const arrived = () => {opening.arrive(); setSettling(false);};
        if (reduced) {arrived(); return;}
        pageSpring(translation, 0, width).start(({finished}) => {
          if (finished && id === revision.current) arrived();
        });
      });
    } else if (opening) opening.arrive();
    else translation.setValue(0);
    return () => {revision.current++; translation.stopAnimation();};
  }, [identity, width, enabled, translation]);
  const onStart = useCallback(() => {setMoving(true); Keyboard.dismiss();}, []);
  const onRelease = useCallback((x: number, velocity: number, cancelled: boolean) => {
    const state = current.current;
    const direction = cancelled ? null : swipeDestination(x, velocity, state.width, state.previous, state.next);
    const destination = direction ? -direction * state.width : 0;
    const id = ++revision.current;
    setSettling(true);
    translation.setValue(x);
    const useNativeDriver = Platform.OS === 'android' || Platform.OS === 'ios';
    const animation = release === 'back' && !reduceMotion.current
      ? pageSpring(translation, destination, state.width, velocity)
      : Animated.timing(translation, {toValue: destination, duration: reduceMotion.current ? 0 : 210,
          easing: Easing.out(Easing.cubic), useNativeDriver});
    animation.start(({finished}) => {
      if (!finished || id !== revision.current) return;
      if (direction) state.onStep(direction);
      else {translation.setValue(0); setMoving(false); setSettling(false);}
    });
  }, [translation, release]);
  const translateX = useMemo(() => translation.interpolate({inputRange: [-Math.max(1, width), 0, Math.max(1, width)],
    outputRange: [next ? -width : 0, 0, previous ? width : 0], extrapolate: 'clamp'}), [translation, width, previous, next]);
  return {translation, translateX, moving, settling,
    enabled: enabled && !settling && (previous || next), onStart, onRelease};
}
