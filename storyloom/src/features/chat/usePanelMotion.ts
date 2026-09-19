import {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, Keyboard, Platform} from 'react-native';
import {selectionHaptic} from './selectionHaptic';

export const panelSpring = {
  stiffness: 260, damping: 32, mass: 1, overshootClamping: true,
  restDisplacementThreshold: 0.001, restSpeedThreshold: 0.001,
} as const;

/** Shared spring and touch tracking for adjacent panels. */
export function usePanelMotion(reduceMotion: boolean) {
  const progress = useRef(new Animated.Value(0)).current;
  const position = useRef(0);
  const target = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const listener = progress.addListener(({value}) => {position.current = value;});
    return () => {progress.stopAnimation(); progress.removeListener(listener);};
  }, [progress]);

  const reset = useCallback(() => {
    progress.stopAnimation();
    target.current = false;
    position.current = 0;
    progress.setValue(0);
    setVisible(false);
  }, [progress]);

  const settle = useCallback((open: boolean) => {
    Keyboard.dismiss();
    if (target.current !== open) selectionHaptic();
    target.current = open;
    progress.stopAnimation();
    if (open) setVisible(true);
    if (reduceMotion) {
      position.current = open ? 1 : 0;
      progress.setValue(position.current);
      setVisible(open);
      return;
    }
    Animated.spring(progress, {
      ...panelSpring, toValue: open ? 1 : 0,
      useNativeDriver: Platform.OS !== 'web',
    }).start(({finished}) => {if (finished && !open && !target.current) setVisible(false);});
  }, [progress, reduceMotion]);

  const begin = useCallback(() => {
    progress.stopAnimation();
    Keyboard.dismiss();
    setVisible(true);
    return position.current;
  }, [progress]);
  const move = useCallback((value: number) => {position.current = value; progress.setValue(value);}, [progress]);
  return {progress, position, target, visible, settle, reset, begin, move};
}
