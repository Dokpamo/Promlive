import {useEffect, useMemo, useRef, type RefObject} from 'react';
import {Animated, PanResponder, Platform} from 'react-native';
import {shouldDismissSheet} from '../settings/sheetMotion';
import {panelSpring} from './usePanelMotion';

/** Drag the existing header/outer margin down; text editing owns its own touches. */
export function useComposerPull(progress: Animated.Value, options: {
  travel: number;
  opening: RefObject<boolean>;
  closing: RefObject<boolean>;
  reduceMotion: boolean;
  close: () => void;
}) {
  const config = useRef(options);
  config.current = options;
  const cancelClick = useRef(false);
  const motion = useRef({position: 0, input: false, dragging: false, offAxis: false, multiple: false, captured: {x: 0, y: 0}, origin: {x: 0, y: 0}, travel: 1, lastMoveAt: 0});

  useEffect(() => {
    const listener = progress.addListener(({value}) => {motion.current.position = value;});
    return () => progress.removeListener(listener);
  }, [progress]);

  const pan = useMemo(() => {
    const ready = () => !config.current.opening.current && !config.current.closing.current;
    const canPull = (dx: number, dy: number) => {
      const m = motion.current;
      if (!ready() || m.input || m.offAxis || m.multiple) return false;
      if ((Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) || dy < -10) m.offAxis = true;
      return !m.offAxis && dy > 10 && dy > Math.abs(dx) * 1.5;
    };
    const begin = (dx = 0, dy = 0) => {
      const m = motion.current;
      progress.stopAnimation();
      m.travel = Math.max(160, config.current.travel);
      m.origin = {x: dx, y: (1 - m.position) * m.travel + dy};
      m.dragging = true;
      cancelClick.current = true;
    };
    const move = (dy: number) => {
      const m = motion.current;
      m.lastMoveAt = Date.now();
      progress.setValue(Math.max(0, Math.min(1, 1 - (m.origin.y + dy) / m.travel)));
    };
    const restore = () => {
      if (config.current.reduceMotion) progress.setValue(1);
      else Animated.spring(progress, {...panelSpring, toValue: 1, useNativeDriver: false}).start();
    };
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: (_, gesture) => {
        const m = motion.current;
        if (gesture.numberActiveTouches > 1) {m.multiple = true; return false;}
        m.input = false; m.dragging = false; m.offAxis = false; m.multiple = false;
        m.captured = {x: 0, y: 0};
        cancelClick.current = false;
        return false;
      },
      // Keep blank header touches out of Native Modal's wrapper responder.
      onStartShouldSetPanResponder: () => ready() && !motion.current.input && Platform.OS !== 'web',
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        if (motion.current.dragging || gesture.numberActiveTouches !== 1 || !canPull(gesture.dx, gesture.dy)) return false;
        motion.current.captured = {x: gesture.dx, y: gesture.dy};
        return true;
      },
      onPanResponderGrant: () => {
        const {x, y} = motion.current.captured;
        // Capture resets PanResponder's deltas; retain the movement already made.
        if (y) {begin(x, y); move(0);}
      },
      onPanResponderStart: (_, gesture) => {if (gesture.numberActiveTouches > 1) motion.current.multiple = true;},
      onPanResponderMove: (_, gesture) => {
        const m = motion.current;
        if (gesture.numberActiveTouches > 1) m.multiple = true;
        if (!ready() || m.multiple || m.input) return;
        if (!m.dragging) {
          if (!canPull(gesture.dx, gesture.dy)) return;
          begin();
        }
        move(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        const m = motion.current;
        if (!m.dragging) return;
        m.dragging = false;
        // PanResponder retains its last velocity while the finger is held still.
        const velocity = Date.now() - m.lastMoveAt > 100 ? 0 : gesture.vy;
        if (!m.multiple && shouldDismissSheet(m.origin.x + gesture.dx, m.origin.y + gesture.dy, velocity, m.travel)) config.current.close();
        else restore();
      },
      onPanResponderTerminate: () => {
        if (motion.current.dragging) {motion.current.dragging = false; restore();}
      },
      onPanResponderTerminationRequest: () => !motion.current.dragging,
      onShouldBlockNativeResponder: () => false,
    });
  }, [progress]);

  return {panHandlers: pan.panHandlers, cancelClick, blockInput: () => {motion.current.input = true; return false;}};
}
