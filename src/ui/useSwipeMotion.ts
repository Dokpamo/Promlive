import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, Easing, Keyboard, Platform} from 'react-native';
import {swipeDestination, type SwipeDirection} from './swipeNavigation';
import {pageSpring, type BackTransition} from './backTransition';
import {createSwipeTranslation} from './swipeTranslation';
import {animationBatch} from './animationBatch';

export function useSwipeMotion({identity, width, previous, next, enabled = true, dismiss = false, onStep, source, release = 'slide', entrance, prepareReset}: {
  identity: string; width: number; previous: boolean; next: boolean; enabled?: boolean;
  dismiss?: boolean;
  onStep: (direction: SwipeDirection) => void;
  source?: Animated.Value;
  release?: 'slide' | 'back';
  entrance?: BackTransition;
  prepareReset?: () => void;
}) {
  const localTranslation = useRef(new Animated.Value(0)).current;
  const translation = source ?? localTranslation;
  const [moving, setMoving] = useState(false);
  const [settling, setSettling] = useState(false);
  const revision = useRef(0);
  const gestureRevision = useRef<number | null>(null);
  const reduceMotion = useRef(false);
  const entry = useRef(entrance); entry.current = entrance;
  const reset = useRef(prepareReset); reset.current = prepareReset;
  const current = useRef({width, previous, next, onStep}); current.current = {width, previous, next, onStep};
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {if (alive) reduceMotion.current = value;});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {reduceMotion.current = value;});
    return () => {alive = false; listener?.remove();};
  }, []);
  useLayoutEffect(() => {
    const id = ++revision.current;
    gestureRevision.current = null;
    const opening = entry.current;
    translation.stopAnimation();
    setMoving(false); setSettling(false);
    const settlePage = (destination: number, completed: () => void) => {
      setSettling(true);
      void AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then(reduced => {
        if (id !== revision.current) return;
        reduceMotion.current = reduced;
        if (reduced) {translation.setValue(destination); completed(); return;}
        pageSpring(translation, destination, width).start(({finished}) => {
          if (finished && id === revision.current) completed();
        });
      });
    };
    // Paging or zooming may disable the back gesture; route entrance still runs.
    // Updating an offscreen native transform before its first attachment can
    // leave the new page outside the viewport on iOS.
    if (dismiss) {
      // Keep both pages mounted while returning. This takes precedence over an
      // unfinished entrance or a gesture-enable change when the keyboard closes.
      settlePage(width, () => current.current.onStep(-1));
    } else if (opening?.isOpening()) {
      translation.setValue(width);
      // Respect Reduce Motion before starting; the previous screen stays painted.
      settlePage(0, () => {opening.arrive(); setSettling(false);});
    } else if (opening) opening.arrive();
    else animationBatch(() => {
      // Commit destination slots and clear travel in the same native batch.
      // A React layout commit can arrive a frame later than setValue(0).
      reset.current?.();
      translation.setValue(0);
    });
    return () => {revision.current++; gestureRevision.current = null; translation.stopAnimation();};
  }, [identity, width, enabled, dismiss, translation]);
  const onStart = useCallback(() => {gestureRevision.current = revision.current; setMoving(true); Keyboard.dismiss();}, []);
  const onRelease = useCallback((x: number, velocity: number, cancelled: boolean) => {
    // A tab/filter press can replace this page before the native finger-up arrives.
    // That old gesture must not start a new transition on the newly selected page.
    if (gestureRevision.current !== revision.current) return;
    gestureRevision.current = null;
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
  const travel = useMemo(() => createSwipeTranslation(translation, width, previous, next), [translation, width]);
  useLayoutEffect(() => {travel.setDirections(previous, next);}, [travel, previous, next]);
  return {translation, translateX: travel.translateX, moving, settling,
    enabled: enabled && !dismiss && !settling && (previous || next), onStart, onRelease};
}
