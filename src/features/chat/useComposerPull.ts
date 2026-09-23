import {useEffect, useMemo, useRef, type RefObject} from 'react';
import {Animated, PanResponder, Platform} from 'react-native';
import {sheetPullDistance, sheetPullLimits, sheetPullOrigin, shouldDismissSheet, type SheetScrollState} from '../../layout/sheetMotion';
import {createSheetScrollHandoff, type SheetScrollPull} from '../../layout/sheetScrollHandoff';
import type {SheetDrag} from '../../layout/SwipeBackModal';

/** Blank space follows the settings sheet's drag physics; text keeps editing/scrolling. */
export function useComposerPull(drag: {x: Animated.Value; y: Animated.Value}, options: {
  travel: number;
  ready: () => boolean;
  grab: () => void;
  restore: () => void;
  close: () => void;
  scroll: RefObject<SheetScrollState>;
  canScrollPull: () => boolean;
}) {
  const config = useRef(options);
  config.current = options;
  const cancelClick = useRef(false);
  const motion = useRef({x: 0, y: 0, input: false, scrolling: false, dragging: false, multiple: false, returnOnly: false, returnLimit: 72, captured: {x: 0, y: 0} as SheetScrollPull, origin: {x: 0, y: 0}, travel: 1, lastMoveAt: 0});

  useEffect(() => {
    const x = drag.x.addListener(({value}) => {motion.current.x = value;});
    const y = drag.y.addListener(({value}) => {motion.current.y = value;});
    return () => {
      drag.x.stopAnimation(); drag.x.removeListener(x);
      drag.y.stopAnimation(); drag.y.removeListener(y);
    };
  }, [drag]);

  const controls = useMemo(() => {
    const ready = () => config.current.ready();
    const handoff = createSheetScrollHandoff();
    const canPull = (dx: number, dy: number) => ready() && !motion.current.multiple &&
      (motion.current.scrolling ? !config.current.scroll.current.nativeGesture && config.current.canScrollPull() : !motion.current.input) && Math.hypot(dx, dy) > 10;
    const begin = (dx = 0, dy = 0, returnOnly = false) => {
      const m = motion.current;
      config.current.grab();
      drag.x.stopAnimation(); drag.y.stopAnimation();
      m.travel = Math.max(160, config.current.travel);
      m.returnOnly = returnOnly;
      m.returnLimit = Math.max(sheetPullLimits.upward, Math.abs(m.y) * 2);
      m.origin = {
        x: sheetPullOrigin(m.x, sheetPullLimits.sideways) + dx,
        y: (m.y < 0 ? sheetPullOrigin(m.y, sheetPullLimits.upward) : returnOnly ? sheetPullOrigin(m.y, m.returnLimit) : m.y) + dy,
      };
      m.dragging = true;
      cancelClick.current = true;
    };
    const move = (dx: number, dy: number) => {
      const m = motion.current;
      m.lastMoveAt = Date.now();
      const down = m.origin.y + dy;
      drag.x.setValue(sheetPullDistance(m.origin.x + dx, sheetPullLimits.sideways));
      drag.y.setValue(down < 0 ? sheetPullDistance(down, sheetPullLimits.upward) : m.returnOnly ? sheetPullDistance(down, m.returnLimit) : Math.min(m.travel, down));
    };
    const restore = () => config.current.restore();
    const release = (dx: number, dy: number, vy: number, cancelled: boolean) => {
      const m = motion.current;
      if (!m.dragging) return;
      m.dragging = false;
      const velocity = Date.now() - m.lastMoveAt > 100 ? 0 : vy;
      if (!cancelled && !m.multiple && !m.returnOnly && shouldDismissSheet(m.origin.x + dx, m.origin.y + dy, velocity, m.travel)) config.current.close();
      else restore();
    };
    const scrollDrag: SheetDrag = {
      canStart: () => ready() && config.current.scroll.current.canScroll && config.current.canScrollPull(),
      begin: (dx, dy, returnOnly) => {begin(dx, dy, returnOnly); move(0, 0);},
      move,
      release: (dx, dy, _vx, vy, cancelled) => release(dx, dy, vy, cancelled),
    };
    const pan = PanResponder.create({
      onStartShouldSetPanResponderCapture: (_, gesture) => {
        const m = motion.current;
        if (gesture.numberActiveTouches > 1) {m.multiple = true; return false;}
        m.input = false; m.scrolling = false; m.dragging = false; m.multiple = false;
        m.captured = {x: 0, y: 0};
        cancelClick.current = false;
        handoff.reset(0, 0, config.current.scroll.current);
        return false;
      },
      // Blank sheet touches belong to the sheet; the editor retains selection and scrolling.
      onStartShouldSetPanResponder: () => ready() && !motion.current.input && !motion.current.scrolling && Platform.OS !== 'web',
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        if (motion.current.dragging || gesture.numberActiveTouches !== 1 || !canPull(gesture.dx, gesture.dy)) return false;
        const claim = motion.current.scrolling ? handoff.move(gesture.dx, gesture.dy, config.current.scroll.current) : {x: gesture.dx, y: gesture.dy};
        if (!claim) return false;
        motion.current.captured = claim;
        return true;
      },
      onPanResponderGrant: () => {
        const {x, y, returnOnly} = motion.current.captured;
        // Capture resets PanResponder's deltas; retain the movement already made.
        begin(x, y, returnOnly); move(0, 0);
      },
      onPanResponderStart: (_, gesture) => {if (gesture.numberActiveTouches > 1) motion.current.multiple = true;},
      onPanResponderMove: (_, gesture) => {
        const m = motion.current;
        if (gesture.numberActiveTouches > 1) m.multiple = true;
        if (!ready() || m.multiple || (m.input && !m.scrolling)) return;
        if (!m.dragging) {
          if (!canPull(gesture.dx, gesture.dy)) return;
          begin();
        }
        move(gesture.dx, gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        release(gesture.dx, gesture.dy, gesture.vy, false);
      },
      onPanResponderTerminate: () => {
        if (motion.current.dragging) {motion.current.dragging = false; restore();}
      },
      onPanResponderTerminationRequest: () => !motion.current.dragging,
      onShouldBlockNativeResponder: () => false,
    });
    return {pan, scrollDrag};
  }, [drag]);

  return {...controls, panHandlers: controls.pan.panHandlers, cancelClick,
    blockInput: () => {motion.current.input = true; return false;},
    blockScroll: () => {motion.current.scrolling = config.current.scroll.current.canScroll; return false;},
  };
}
