import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Keyboard, Platform} from 'react-native';
import {historyDragOrigin, historyDragPosition, shouldDismissHistory} from './drawerMotion';
import {selectionHaptic} from './selectionHaptic';
import {panelSpring} from './usePanelMotion';

/** A floating side sheet: mount offscreen, animate both axes, then unmount. */
export function useHistoryPull(travel: number, reduceMotion: boolean) {
  const offset = useRef(new Animated.ValueXY({x: -travel, y: 0})).current;
  const [visible, setVisible] = useState(false);
  const target = useRef(false);
  const config = useRef({travel, reduceMotion});
  config.current = {travel, reduceMotion};
  const motion = useRef({
    mounted: false, laidOut: false, generation: 0, frame: 0,
    origin: {x: 0, y: 0}, delta: {x: 0, y: 0},
    dragging: false, dragReady: false, lastMoveAt: 0,
  });
  // Keep the native animated nodes attached across unrelated React renders.
  const transform = useMemo(() => offset.getTranslateTransform(), [offset]);

  useEffect(() => () => {
    motion.current.generation++;
    cancelAnimationFrame(motion.current.frame);
    offset.stopAnimation();
  }, [offset]);

  const animate = useCallback((open: boolean) => {
    const m = motion.current;
    const generation = ++m.generation;
    cancelAnimationFrame(m.frame);
    offset.stopAnimation();
    m.dragging = false;
    const toValue = {x: open ? 0 : -config.current.travel, y: 0};
    const finish = () => {
      if (generation !== m.generation || target.current !== open) return;
      if (!open) {m.mounted = false; m.laidOut = false; setVisible(false);}
    };
    if (config.current.reduceMotion) {offset.setValue(toValue); finish(); return;}
    // ValueXY completes only after horizontal travel AND vertical recovery finish.
    Animated.spring(offset, {
      ...panelSpring, toValue,
      // These values are now pixels, rather than a normalized 0–1 progress.
      restDisplacementThreshold: panelSpring.restDisplacementThreshold * config.current.travel,
      restSpeedThreshold: panelSpring.restSpeedThreshold * config.current.travel,
      useNativeDriver: Platform.OS !== 'web',
    }).start(({finished}) => {if (finished) finish();});
  }, [offset]);

  const settle = useCallback((open: boolean) => {
    const m = motion.current;
    Keyboard.dismiss();
    if (target.current !== open) selectionHaptic();
    target.current = open;
    if (!m.mounted) {
      if (!open) return;
      m.generation++;
      offset.stopAnimation();
      offset.setValue({x: -config.current.travel, y: 0});
      m.mounted = true; m.laidOut = false;
      setVisible(true);
      return; // Settings also waits for the surface to be laid out before entering.
    }
    if (m.laidOut) animate(open);
  }, [animate, offset]);

  const onLayout = useCallback(() => {
    const m = motion.current;
    if (!m.mounted || m.laidOut) return;
    m.laidOut = true;
    const generation = m.generation;
    m.frame = requestAnimationFrame(() => {
      if (generation === m.generation && m.mounted) animate(target.current);
    });
  }, [animate]);

  const reset = useCallback(() => {
    const m = motion.current;
    m.generation++; m.mounted = false; m.laidOut = false; m.dragging = false;
    target.current = false;
    cancelAnimationFrame(m.frame);
    offset.stopAnimation(); offset.setValue({x: -config.current.travel, y: 0});
    setVisible(false);
  }, [offset]);

  const move = useCallback((dx: number, dy: number) => {
    const m = motion.current;
    m.delta = {x: dx, y: dy}; m.lastMoveAt = Date.now();
    if (!m.dragReady || !m.dragging) return;
    offset.setValue(historyDragPosition({x: m.origin.x + dx, y: m.origin.y + dy}, config.current.travel));
  }, [offset]);

  const begin = useCallback((dx: number, dy: number) => {
    const m = motion.current;
    const generation = ++m.generation;
    cancelAnimationFrame(m.frame);
    m.dragging = true; m.dragReady = false; m.delta = {x: 0, y: 0};
    Keyboard.dismiss();
    // Grab the actual displayed position, including an interrupted spring.
    const position = {x: 0, y: 0};
    let remaining = 2;
    const receive = (axis: 'x' | 'y', value: number) => {
      position[axis] = value;
      if (--remaining) return;
      if (generation !== m.generation || !m.dragging) return;
      const origin = historyDragOrigin(position);
      m.origin = {x: origin.x + dx, y: origin.y + dy};
      m.dragReady = true;
      move(m.delta.x, m.delta.y);
    };
    // ValueXY's callback only reads JS's cached values; query each native axis.
    offset.x.stopAnimation(value => receive('x', value));
    offset.y.stopAnimation(value => receive('y', value));
  }, [move, offset]);

  const release = useCallback((dx: number, dy: number, vx: number, cancelled: boolean) => {
    const m = motion.current;
    const velocity = Date.now() - m.lastMoveAt > 100 ? 0 : vx;
    const dismiss = shouldDismissHistory(m.origin.x + dx, m.origin.y + dy, velocity, config.current.travel);
    settle(cancelled || !m.dragReady ? target.current : !dismiss);
  }, [settle]);

  return {visible, target, reset, begin, move, release, settle, transform, onLayout};
}
