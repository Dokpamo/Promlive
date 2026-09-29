import {createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Animated, Platform, type NativeScrollEvent, type NativeSyntheticEvent} from 'react-native';
import {useItemReducedMotion} from '../layout/itemListMotion';
import {ScrollChromeMotion} from '../layout/scrollChrome';
import {panelSpringForDistance} from '../layout/panelAnimation';
import {usePagingLock} from '../layout/PagingBoundary';

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

export function useNavigationChrome(tab: string, active: boolean, bottomInset: number) {
  const motion = useRef(new ScrollChromeMotion()).current;
  const progress = useRef(new Animated.Value(1)).current;
  const topInset = useRef(0);
  const phase = useRef<'idle' | 'drag' | 'ending' | 'momentum' | 'wheel' | 'settling'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scroller = useRef<((offset: number) => void) | null>(null);
  const snap = useRef<ReturnType<ScrollChromeMotion['snap']> | null>(null);
  const requestedOffsets = useRef<number[]>([]);
  const [visible, setVisible] = useState(true);
  const [selection, setSelection] = useState<{selecting: boolean; progress: Animated.Value | null}>({selecting: false, progress: null});
  const shown = useRef(true);
  const reduced = useItemReducedMotion();
  const latest = useRef({active, bottomInset, reduced});
  latest.current = {active, bottomInset, reduced};
  const clearTimer = useCallback(() => {if (timer.current) clearTimeout(timer.current); timer.current = null;}, []);
  const setTopInset = useCallback((height: number) => {topInset.current = height;}, []);
  const registerScroller = useCallback((scrollTo: (offset: number) => void) => {
    scroller.current = scrollTo;
    return () => {if (scroller.current === scrollTo) scroller.current = null;};
  }, []);
  const reset = useCallback(() => {
    snap.current = null; requestedOffsets.current = [];
    clearTimer(); phase.current = 'idle'; progress.stopAnimation(); motion.reset(); progress.setValue(1);
    shown.current = true; setVisible(true);
  }, [clearTimer, motion, progress]);
  useLayoutEffect(reset, [reset, tab, active]);
  useEffect(() => {
    const listener = progress.addListener(({value}) => {
      motion.progress = value;
      if (snap.current && scroller.current) {
        const offset = snap.current.offsetAt(value);
        requestedOffsets.current = [...requestedOffsets.current.slice(-31), offset];
        scroller.current(offset);
      }
      const next = value > 0.001;
      if (shown.current !== next) {shown.current = next; setVisible(next);}
    });
    return () => {clearTimer(); progress.stopAnimation(); progress.removeListener(listener);};
  }, [clearTimer, motion, progress]);
  const handlers = useMemo(() => {
    const metrics = (event: ScrollEvent) => {
      const e = event.nativeEvent;
      return [e.contentOffset.y, e.contentSize.height, e.layoutMeasurement.height] as const;
    };
    const travel = () => Math.max(1, topInset.current || latest.current.bottomInset);
    const follow = (event: ScrollEvent) => progress.setValue(motion.update(...metrics(event), travel()));
    const stop = () => {
      clearTimer();
      snap.current = null; requestedOffsets.current = [];
      // JS-driven progress can be grabbed synchronously, even halfway through settling.
      progress.stopAnimation(value => {motion.progress = value;});
    };
    const settle = () => {
      clearTimer(); phase.current = 'settling';
      snap.current = motion.snap(travel());
      const toValue = snap.current.target;
      if (latest.current.reduced) {progress.setValue(toValue); snap.current = null; phase.current = 'idle'; return;}
      Animated.spring(progress, {...panelSpringForDistance(travel()), toValue, useNativeDriver: false})
        .start(({finished}) => {if (finished) {snap.current = null; phase.current = 'idle';}});
    };
    const defer = (delay: number) => {clearTimer(); timer.current = setTimeout(settle, delay);};
    return {
      onScrollBeginDrag: (event: ScrollEvent) => {
        if (!latest.current.active) return;
        stop(); phase.current = 'drag'; motion.capture(...metrics(event));
      },
      onScroll: (event: ScrollEvent) => {
        if (!latest.current.active) return;
        // Scroll commands from the spring echo back as native/web scroll events.
        // Consume them without mistaking them for another user gesture.
        const requested = requestedOffsets.current.findIndex(offset => Math.abs(offset - event.nativeEvent.contentOffset.y) < 1);
        if (requested >= 0) {
          requestedOffsets.current.splice(0, requested + 1);
          motion.capture(...metrics(event));
          return;
        }
        if (phase.current === 'idle' || phase.current === 'settling') {
          if (Platform.OS !== 'web') {motion.capture(...metrics(event)); return;}
          stop(); phase.current = 'wheel';
        }
        follow(event);
        if (phase.current === 'wheel') defer(120);
        else if (phase.current === 'ending') defer(80);
      },
      onScrollEndDrag: (event: ScrollEvent) => {
        if (!latest.current.active || phase.current !== 'drag') return;
        follow(event); phase.current = 'ending'; defer(80);
      },
      onMomentumScrollBegin: (_event: ScrollEvent) => {if (latest.current.active && phase.current === 'ending') {clearTimer(); phase.current = 'momentum';}},
      onMomentumScrollEnd: (event: ScrollEvent) => {
        if (!latest.current.active || (phase.current !== 'momentum' && phase.current !== 'ending')) return;
        follow(event); settle();
      },
    };
  }, [clearTimer, motion, progress]);
  return useMemo(() => ({visible, selecting: selection.selecting, navigationProgress: selection.progress, setSelection, progress, bottomInset, reset, setTopInset, registerScroller, ...handlers}), [visible, selection, progress, bottomInset, reset, setTopInset, registerScroller, handlers]);
}

export const NavigationChrome = createContext<ReturnType<typeof useNavigationChrome> | null>(null);
export function useCollectionChrome() {return useContext(NavigationChrome);}

/** Selection owns the active page until it is cancelled or its work is finished. */
export function useCollectionSelection(active: boolean, selecting: boolean, progress: Animated.Value | null = null) {
  const update = useCollectionChrome()?.setSelection;
  usePagingLock(active && selecting);
  useLayoutEffect(() => {
    if (!active) return;
    update?.({selecting, progress});
    return () => update?.({selecting: false, progress: null});
  }, [active, selecting, progress, update]);
}
