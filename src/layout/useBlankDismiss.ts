import {useCallback, useEffect, useLayoutEffect, useMemo, useRef} from 'react';
import {Animated, PanResponder, Platform} from 'react-native';
import {useItemReducedMotion} from './itemListMotion';
import {shouldDismissSheet} from './sheetMotion';
import {editorExitSpring, panelSpringForDistance} from './panelAnimation';

/** Full-screen editors only follow a downward drag that starts outside text and controls. */
export function useBlankDismiss(options: {
  active: boolean; height: number; onClose: () => void; entrance?: 'waiting' | 'ready';
  onDismissStart?: () => void;
  /** The composer owns its return to the compact bar, including the drag offset. */
  onGrab?: () => void; onRestore?: () => void; managedExit?: boolean;
}) {
  const {active, height, entrance} = options;
  const y = useRef(new Animated.Value(active && entrance ? height : 0)).current;
  const cancelClick = useRef(false);
  const reduced = useItemReducedMotion();
  const latest = useRef({...options, reduced});
  latest.current = {...options, reduced};
  const entry = useRef({active: false, pending: false, moving: false});
  const closing = useRef(false);
  const state = useRef({blocked: false, dragging: false, multiple: false, offAxis: false, origin: 0, position: 0, captured: 0, lastMove: 0});
  const generation = useRef(0);
  useEffect(() => {
    const listener = y.addListener(({value}) => {state.current.position = value;});
    return () => {generation.current++; y.stopAnimation(); y.removeListener(listener);};
  }, [y]);
  useLayoutEffect(() => {
    if (!active) {
      generation.current++; y.stopAnimation(); y.setValue(0); state.current.dragging = false;
      closing.current = false;
      entry.current = {active: false, pending: false, moving: false};
      return;
    }
    const e = entry.current;
    if (closing.current) return;
    if (!e.active) {e.active = true; e.pending = entrance !== undefined;}
    if (e.pending) y.setValue(reduced ? 0 : height);
    if (entrance !== 'ready' || !e.pending) {
      if (reduced && e.moving) {e.moving = false; y.stopAnimation(); y.setValue(0);}
      return;
    }
    e.pending = false;
    if (reduced) return;
    e.moving = true;
    // Only translate the finished full-screen layout; never resize/reflow the editor.
    Animated.spring(y, {...panelSpringForDistance(), toValue: 0, useNativeDriver: false})
      .start(() => {e.moving = false;});
  }, [active, entrance, height, reduced, y]);
  const settle = useCallback((close: boolean) => {
    if (closing.current) return;
    state.current.dragging = false;
    const attempt = ++generation.current;
    y.stopAnimation();
    if (close) {
      closing.current = true;
      entry.current.pending = false;
      latest.current.onDismissStart?.();
      if (latest.current.managedExit) {latest.current.onClose(); return;}
    } else if (latest.current.onRestore) {latest.current.onRestore(); return;}
    const finish = () => {if (attempt === generation.current && close) latest.current.onClose();};
    const target = close ? latest.current.height : 0;
    if (latest.current.reduced) {y.setValue(target); finish(); return;}
    Animated.spring(y, {...(close ? editorExitSpring() : panelSpringForDistance()), toValue: target, useNativeDriver: false})
      .start(({finished}) => {if (finished) finish();});
  }, [y]);
  const dismiss = useCallback(() => settle(true), [settle]);
  const pan = useMemo(() => {
    const move = (dy: number) => {
      state.current.lastMove = Date.now();
      y.setValue(Math.max(0, Math.min(latest.current.height, state.current.origin + dy)));
    };
    const canStart = (dx: number, dy: number) => {
      const m = state.current;
      if (!latest.current.active || (closing.current && !latest.current.managedExit) || latest.current.entrance === 'waiting' || m.blocked || m.multiple || m.offAxis) return false;
      if ((Math.abs(dx) > 10 && Math.abs(dx) >= Math.abs(dy)) || dy < -10) m.offAxis = true;
      return !m.offAxis && dy > 10 && dy > Math.abs(dx) * 1.25;
    };
    const begin = (captured: number) => {
      latest.current.onGrab?.();
      closing.current = false;
      generation.current++; y.stopAnimation();
      state.current.origin = state.current.position + captured;
      state.current.dragging = true;
      cancelClick.current = true;
      move(0);
    };
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: (_, gesture) => {
        if (gesture.numberActiveTouches > 1) {state.current.multiple = true; return false;}
        Object.assign(state.current, {blocked: false, dragging: false, multiple: false, offAxis: false, captured: 0});
        cancelClick.current = false;
        return false;
      },
      onStartShouldSetPanResponder: () => latest.current.active && !closing.current && latest.current.entrance !== 'waiting' && !state.current.blocked && Platform.OS !== 'web',
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        if (state.current.dragging || gesture.numberActiveTouches !== 1 || !canStart(gesture.dx, gesture.dy)) return false;
        state.current.captured = gesture.dy;
        return true;
      },
      onPanResponderGrant: () => {if (state.current.captured) begin(state.current.captured);},
      onPanResponderStart: (_, gesture) => {if (gesture.numberActiveTouches > 1) state.current.multiple = true;},
      onPanResponderMove: (_, gesture) => {
        const m = state.current;
        if (gesture.numberActiveTouches > 1) m.multiple = true;
        if (!latest.current.active || m.blocked || m.multiple) return;
        if (!m.dragging) {if (!canStart(gesture.dx, gesture.dy)) return; begin(0);}
        move(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        const m = state.current;
        if (!m.dragging) return;
        const vy = Date.now() - m.lastMove > 100 ? 0 : gesture.vy;
        settle(!m.multiple && shouldDismissSheet(0, m.position, vy, latest.current.height));
      },
      onPanResponderTerminate: () => {if (state.current.dragging) settle(false);},
      onPanResponderTerminationRequest: () => !state.current.dragging,
      onShouldBlockNativeResponder: () => false,
    });
  }, [settle, y]);
  return {y, dismiss, panHandlers: pan.panHandlers, cancelClick, block: () => {state.current.blocked = true; return false;}};
}
