import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Keyboard, Platform} from 'react-native';
import {historyDragOrigin, historyDragPosition, shouldDismissHistory} from './drawerMotion';
import {selectionHaptic} from '../../layout/selectionHaptic';
import {panelSpringForDistance, stopAndRead} from '../../layout/panelAnimation';

/** A floating side sheet: mount offscreen, animate both axes, then unmount. */
export function useHistoryPull(travel: number, reduceMotion: boolean) {
  const offset = useRef(new Animated.ValueXY({x: -travel, y: 0})).current;
  const [visible, setVisible] = useState(false);
  const target = useRef(false);
  const config = useRef({travel, reduceMotion});
  config.current = {travel, reduceMotion};
  const motion = useRef({
    mounted: false, laidOut: false, generation: 0, frame: 0,
    position: {x: -travel, y: 0}, origin: {x: 0, y: 0}, delta: {x: 0, y: 0},
    dragging: false, lastMoveAt: 0,
  });
  // Keep the native animated nodes attached across unrelated React renders.
  const transform = useMemo(() => offset.getTranslateTransform(), [offset]);
  const progress = useMemo(() => offset.x.interpolate({
    inputRange: [-travel, 0], outputRange: [0, 1], extrapolate: 'clamp',
  }), [offset, travel]);

  useEffect(() => {
    const x = offset.x.addListener(({value}) => {if (!motion.current.dragging) motion.current.position.x = value;});
    const y = offset.y.addListener(({value}) => {if (!motion.current.dragging) motion.current.position.y = value;});
    return () => {
      motion.current.generation++;
      cancelAnimationFrame(motion.current.frame);
      offset.stopAnimation();
      offset.x.removeListener(x); offset.y.removeListener(y);
    };
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
      m.position = toValue;
      if (!open) {m.mounted = false; m.laidOut = false; setVisible(false);}
    };
    if (config.current.reduceMotion) {offset.setValue(toValue); finish(); return;}
    // ValueXY completes only after horizontal travel AND vertical recovery finish.
    Animated.spring(offset, {
      ...panelSpringForDistance(), toValue,
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
      m.position = {x: -config.current.travel, y: 0};
      offset.setValue(m.position);
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
    m.position = {x: -config.current.travel, y: 0};
    offset.stopAnimation(); offset.setValue(m.position);
    setVisible(false);
  }, [offset]);

  const move = useCallback((dx: number, dy: number) => {
    const m = motion.current;
    m.delta = {x: dx, y: dy}; m.lastMoveAt = Date.now();
    if (!m.dragging) return;
    m.position = historyDragPosition({x: m.origin.x + dx, y: m.origin.y + dy}, config.current.travel);
    offset.setValue(m.position);
  }, [offset]);

  const begin = useCallback((dx: number, dy: number) => {
    const m = motion.current;
    const generation = ++m.generation;
    cancelAnimationFrame(m.frame);
    m.dragging = true; m.delta = {x: 0, y: 0};
    Keyboard.dismiss();
    const setOrigin = (position: {x: number; y: number}) => {
      const origin = historyDragOrigin(position);
      m.origin = {x: origin.x + dx, y: origin.y + dy};
    };
    setOrigin(m.position);
    // ValueXY's callback only reads JS's cached values; query each native axis.
    // Follow new touches immediately while those reads are in flight.
    stopAndRead([offset.x, offset.y], ([x, y]) => {
      if (generation !== m.generation) return;
      setOrigin({x: x!, y: y!});
      move(m.delta.x, m.delta.y);
    });
    move(0, 0);
  }, [move, offset]);

  const release = useCallback((dx: number, dy: number, vx: number, cancelled: boolean) => {
    const m = motion.current;
    const velocity = Date.now() - m.lastMoveAt > 100 ? 0 : vx;
    const dismiss = shouldDismissHistory(m.origin.x + dx, m.origin.y + dy, velocity, config.current.travel);
    settle(cancelled ? target.current : !dismiss);
  }, [settle]);

  return {visible, target, reset, begin, move, release, settle, transform, progress, onLayout};
}
