import {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, Keyboard, Platform} from 'react-native';
import {selectionHaptic} from './selectionHaptic';
import {drawerProgress, shouldOpenDrawer} from './drawerMotion';
import {panelSpringForDistance, stopAndRead} from './panelAnimation';

export {panelSpring} from './panelAnimation';

/** Shared spring and touch tracking for adjacent panels. */
export function usePanelMotion(reduceMotion: boolean, travel: number) {
  const progress = useRef(new Animated.Value(0)).current;
  const position = useRef(0);
  const target = useRef(false);
  const [visible, setVisible] = useState(false);
  const motion = useRef({generation: 0, dragging: false, origin: 0, delta: 0, lastMoveAt: 0});

  useEffect(() => {
    const listener = progress.addListener(({value}) => {if (!motion.current.dragging) position.current = value;});
    return () => {motion.current.generation++; progress.stopAnimation(); progress.removeListener(listener);};
  }, [progress]);

  const reset = useCallback(() => {
    motion.current.generation++;
    motion.current.dragging = false;
    progress.stopAnimation();
    target.current = false;
    position.current = 0;
    progress.setValue(0);
    setVisible(false);
  }, [progress]);

  const settle = useCallback((open: boolean) => {
    const m = motion.current;
    const generation = ++m.generation;
    m.dragging = false;
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
      ...panelSpringForDistance(travel), toValue: open ? 1 : 0,
      useNativeDriver: Platform.OS !== 'web',
    }).start(({finished}) => {
      if (!finished || generation !== m.generation) return;
      position.current = open ? 1 : 0;
      setVisible(open);
    });
  }, [progress, reduceMotion, travel]);

  const move = useCallback((delta: number) => {
    const m = motion.current;
    m.delta = delta; m.lastMoveAt = Date.now();
    if (!m.dragging) return;
    position.current = drawerProgress(m.origin, delta, 1);
    progress.setValue(position.current);
  }, [progress]);
  const release = useCallback((delta: number, velocity: number, cancelled = false) => {
    const m = motion.current;
    m.delta = delta;
    if (Date.now() - m.lastMoveAt > 100) velocity = 0;
    settle(cancelled ? target.current : shouldOpenDrawer(drawerProgress(m.origin, delta, 1), velocity));
  }, [settle]);
  const begin = useCallback((capturedDelta = 0) => {
    const m = motion.current;
    const generation = ++m.generation;
    m.dragging = true; m.origin = position.current + capturedDelta; m.delta = 0; m.lastMoveAt = Date.now();
    Keyboard.dismiss();
    setVisible(true);
    stopAndRead([progress], ([value]) => {
      if (generation !== m.generation) return;
      m.origin = value! + capturedDelta;
      move(m.delta);
    });
    // Follow the finger immediately; reconcile the stopped native position
    // when its asynchronous read arrives instead of waiting to start moving.
    move(0);
  }, [move, progress]);
  return {progress, position, target, visible, settle, reset, begin, move, release};
}
