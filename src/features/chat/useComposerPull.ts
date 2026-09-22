import {useEffect, useMemo, useRef} from 'react';
import {Animated, PanResponder, Platform} from 'react-native';
import {sheetPullDistance, sheetPullLimits, sheetPullOrigin, shouldDismissSheet} from '../settings/sheetMotion';

/** Blank space follows the settings sheet's drag physics; text keeps editing/scrolling. */
export function useComposerPull(drag: {x: Animated.Value; y: Animated.Value}, options: {
  travel: number;
  ready: () => boolean;
  grab: () => void;
  restore: () => void;
  close: () => void;
}) {
  const config = useRef(options);
  config.current = options;
  const cancelClick = useRef(false);
  const motion = useRef({x: 0, y: 0, input: false, dragging: false, multiple: false, captured: {x: 0, y: 0}, origin: {x: 0, y: 0}, travel: 1, lastMoveAt: 0});

  useEffect(() => {
    const x = drag.x.addListener(({value}) => {motion.current.x = value;});
    const y = drag.y.addListener(({value}) => {motion.current.y = value;});
    return () => {
      drag.x.stopAnimation(); drag.x.removeListener(x);
      drag.y.stopAnimation(); drag.y.removeListener(y);
    };
  }, [drag]);

  const pan = useMemo(() => {
    const ready = () => config.current.ready();
    const canPull = (dx: number, dy: number) => ready() && !motion.current.input && !motion.current.multiple && Math.hypot(dx, dy) > 10;
    const begin = (dx = 0, dy = 0) => {
      const m = motion.current;
      config.current.grab();
      drag.x.stopAnimation(); drag.y.stopAnimation();
      m.travel = Math.max(160, config.current.travel);
      m.origin = {
        x: sheetPullOrigin(m.x, sheetPullLimits.sideways) + dx,
        y: (m.y < 0 ? sheetPullOrigin(m.y, sheetPullLimits.upward) : m.y) + dy,
      };
      m.dragging = true;
      cancelClick.current = true;
    };
    const move = (dx: number, dy: number) => {
      const m = motion.current;
      m.lastMoveAt = Date.now();
      const down = m.origin.y + dy;
      drag.x.setValue(sheetPullDistance(m.origin.x + dx, sheetPullLimits.sideways));
      drag.y.setValue(down < 0 ? sheetPullDistance(down, sheetPullLimits.upward) : Math.min(m.travel, down));
    };
    const restore = () => config.current.restore();
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: (_, gesture) => {
        const m = motion.current;
        if (gesture.numberActiveTouches > 1) {m.multiple = true; return false;}
        m.input = false; m.dragging = false; m.multiple = false;
        m.captured = {x: 0, y: 0};
        cancelClick.current = false;
        return false;
      },
      // Blank sheet touches belong to the sheet; the editor retains selection and scrolling.
      onStartShouldSetPanResponder: () => ready() && !motion.current.input && Platform.OS !== 'web',
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        if (motion.current.dragging || gesture.numberActiveTouches !== 1 || !canPull(gesture.dx, gesture.dy)) return false;
        motion.current.captured = {x: gesture.dx, y: gesture.dy};
        return true;
      },
      onPanResponderGrant: () => {
        const {x, y} = motion.current.captured;
        // Capture resets PanResponder's deltas; retain the movement already made.
        begin(x, y); move(0, 0);
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
        move(gesture.dx, gesture.dy);
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
  }, [drag]);

  return {panHandlers: pan.panHandlers, cancelClick, blockInput: () => {motion.current.input = true; return false;}};
}
