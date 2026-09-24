import {createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject} from 'react';
import {AccessibilityInfo, Animated, Keyboard, Modal, PanResponder, Platform, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {selectionHaptic} from './selectionHaptic';
import {panelSpringForDistance, stopAndRead} from './panelAnimation';
import {useScreenCorners} from './useScreenCorners';
import {syncSystemBars, useAppearance} from '../features/appearance/AppAppearance';
import {DragClickBoundary} from './DragClickBoundary';
import {sheetPullDistance, sheetPullLimits, sheetPullOrigin, shouldDismissSheet, type SheetScrollState} from './sheetMotion';
import {createSheetScrollHandoff, type SheetScrollPull} from './sheetScrollHandoff';
import {SheetGestureRoot} from './SheetGestureRoot';

export interface SheetDrag {
  canStart: () => boolean;
  begin: (dx: number, dy: number, returnOnly?: boolean) => void;
  move: (dx: number, dy: number) => void;
  release: (dx: number, dy: number, vx: number, vy: number, cancelled: boolean) => void;
}

const GestureGuard = createContext<{
  blocked: {current: boolean};
  sheet: boolean;
  scroller: {current: RefObject<SheetScrollState> | null};
  panels: RefObject<Map<symbol, () => void>>;
  exitingPanels: RefObject<Set<symbol>>;
  canInteract: () => boolean;
  sheetDrag: SheetDrag;
} | null>(null);

export function useSheetDrag() {return useContext(GestureGuard)?.sheetDrag;}

/** Keep horizontal editing and switch gestures inside their own controls. */
export function SwipeBackBoundary({children, style}: {children: ReactNode; style?: StyleProp<ViewStyle>}) {
  const guard = useContext(GestureGuard);
  return <View style={style} onStartShouldSetResponderCapture={() => {if (guard?.canInteract()) guard.blocked.current = true; return false;}}>{children}</View>;
}

/** Keep the initial responder inside the native scroller so it can scroll vertically. */
export function SwipeBackScrollContent({children, sheetScroll}: {children: ReactNode; sheetScroll?: RefObject<SheetScrollState>}) {
  const guard = useContext(GestureGuard);
  return <View onStartShouldSetResponderCapture={() => {if (guard?.sheet && guard.canInteract()) guard.scroller.current = sheetScroll ?? null; return false;}} onStartShouldSetResponder={() => Platform.OS !== 'web' && (guard?.canInteract() ?? true)} onResponderGrant={() => false} onResponderTerminationRequest={() => true}>{children}</View>;
}

/** A transparent modal keeps the previous screen visible beneath a back swipe. */
export function SwipeBackModal({onClose, onDismissStart, onBackRequest, onShow, children, sheet = false, sheetHeight = 0, slideFrom = 'bottom', dismiss = false, active = true, fixed = false}: {
  onClose: () => void;
  onDismissStart?: () => void;
  onBackRequest?: () => boolean;
  onShow?: () => void;
  children: (close: () => void, motionStyle: Animated.WithAnimatedObject<ViewStyle>) => ReactNode;
  sheet?: boolean;
  sheetHeight?: number;
  slideFrom?: 'bottom' | 'right';
  dismiss?: boolean;
  active?: boolean;
  /** Keep full-screen editors in the modal stack without sheet motion or edge gestures. */
  fixed?: boolean;
}) {
  const {isDark} = useAppearance();
  const parentGuard = useContext(GestureGuard);
  const parentPanels = parentGuard?.panels;
  const parentExitingPanels = parentGuard?.exitingPanels;
  // A second native Modal owns the window until unmount, even with no touches.
  // Detail pages and sheets share one window so exit motion never holds the next gesture.
  const inline = parentPanels !== undefined;
  const panelId = useRef(Symbol('settings-panel')).current;
  const panels = useRef(new Map<symbol, () => void>());
  const exitingPanels = useRef(new Set<symbol>());
  const gestureView = useRef<View>(null);
  const {width, height} = useWindowDimensions();
  const horizontal = !sheet || slideFrom === 'right';
  const travel = horizontal ? width : sheetHeight || height;
  const crossLimit = horizontal ? sheetPullLimits.upward : sheetPullLimits.sideways;
  const corners = useScreenCorners();
  const progress = useRef(new Animated.Value(fixed ? 0 : 1)).current;
  const pull = useRef(new Animated.Value(0)).current;
  const sideways = useRef(new Animated.Value(0)).current;
  const sidewaysOrigin = useRef(0);
  const position = useRef(1);
  const pullPosition = useRef({upward: 0, side: 0});
  const origin = useRef(1);
  const blocked = useRef(false);
  const scroller = useRef<RefObject<SheetScrollState> | null>(null);
  const scrollHandoff = useRef(createSheetScrollHandoff());
  const capturedSheetDrag = useRef<SheetScrollPull | null>(null);
  const cancelClick = useRef(false);
  const offAxis = useRef(false);
  const dragging = useRef(false);
  const multipleTouches = useRef(false);
  const closing = useRef(false);
  const finalized = useRef(false);
  const generation = useRef(0);
  const dragState = useRef({resumeClose: false, returnOnly: false, returnLimit: sheetPullLimits.upward as number, captured: {x: 0, y: 0}, delta: {x: 0, y: 0}, lastMoveAt: 0});
  const entered = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onDismissStartRef = useRef(onDismissStart);
  onDismissStartRef.current = onDismissStart;
  const onBackRequestRef = useRef(onBackRequest);
  onBackRequestRef.current = onBackRequest;
  const onShowRef = useRef(onShow);
  onShowRef.current = onShow;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [shown, setShown] = useState(inline);
  const [dismissing, setDismissing] = useState(false);

  const canInteract = useCallback(() => active && !finalized.current && !((sheet || inline) && closing.current) && panels.current.size === 0, [active, inline, sheet]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {if (mounted) setReduceMotion(value);});
    const change = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {mounted = false; change.remove();};
  }, []);

  useEffect(() => {
    const listener = progress.addListener(({value}) => {if (!dragging.current) position.current = value;});
    const upListener = pull.addListener(({value}) => {if (!dragging.current) pullPosition.current.upward = value;});
    const sideListener = sideways.addListener(({value}) => {if (!dragging.current) pullPosition.current.side = value;});
    return () => {
      generation.current++;
      progress.stopAnimation(); progress.removeListener(listener);
      pull.stopAnimation(); sideways.stopAnimation();
      pull.removeListener(upListener); sideways.removeListener(sideListener);
    };
  }, [progress, pull, sideways]);

  const settle = useCallback((back: boolean) => {
    if (finalized.current) return;
    const startingClose = back && !closing.current;
    const attempt = ++generation.current;
    dragging.current = false;
    progress.stopAnimation();
    pull.stopAnimation();
    sideways.stopAnimation();
    closing.current = back;
    if (startingClose) onDismissStartRef.current?.();
    if (sheet || inline) {
      // The exit spring stays visible, but the next touch belongs to the parent.
      if (back) {
        parentPanels?.current.delete(panelId);
        parentExitingPanels?.current.add(panelId);
      }
      // Release native hit testing before waiting for React's outgoing-page update.
      if (Platform.OS !== 'web') gestureView.current?.setNativeProps({pointerEvents: back ? 'none' : 'auto'});
      setDismissing(back);
    }
    if (back) {
      // Fixed editor surfaces coordinate their own keyboard and exit animation.
      if (!fixed) Keyboard.dismiss();
      selectionHaptic();
    }
    const finish = () => {
      if (attempt !== generation.current || finalized.current) return;
      position.current = back ? 1 : 0;
      if (back) {finalized.current = true; onCloseRef.current();}
    };
    if (fixed || reduceMotion) {
      progress.setValue(back ? 1 : 0);
      pull.setValue(0);
      sideways.setValue(0);
      finish();
      return;
    }
    const slide = Animated.spring(progress, {
      ...panelSpringForDistance(travel),
      toValue: back ? 1 : 0,
      useNativeDriver: Platform.OS !== 'web',
    });
    const animation = sheet ? Animated.parallel([
      slide,
      Animated.spring(pull, {...panelSpringForDistance(), toValue: 0, useNativeDriver: Platform.OS !== 'web'}),
      Animated.spring(sideways, {...panelSpringForDistance(), toValue: 0, useNativeDriver: Platform.OS !== 'web'}),
    ]) : slide;
    animation.start(({finished}) => {if (finished) finish();});
  }, [fixed, inline, parentExitingPanels, parentPanels, progress, pull, reduceMotion, sheet, panelId, sideways, travel]);
  const close = useCallback(() => {if (!closing.current) settle(true);}, [settle]);
  useEffect(() => {if (dismiss) close();}, [close, dismiss]);
  const requestClose = useCallback(() => {
    const topPanel = Array.from(panels.current.values()).at(-1);
    if (topPanel) topPanel(); else if (!onBackRequestRef.current?.()) close();
  }, [close]);

  useLayoutEffect(() => {
    if (!inline || dismissing) return;
    parentPanels.current.set(panelId, requestClose);
    return () => {parentPanels.current.delete(panelId);};
  }, [requestClose, inline, parentPanels, dismissing, panelId]);
  useLayoutEffect(() => () => {parentExitingPanels?.current.delete(panelId);}, [parentExitingPanels, panelId]);
  useEffect(() => {if (inline) onShowRef.current?.();}, [inline]);

  useEffect(() => {
    if (!shown || (sheet && !sheetHeight) || reduceMotion === null || entered.current || closing.current) return;
    entered.current = true;
    settle(false);
  }, [reduceMotion, settle, sheet, sheetHeight, shown]);

  const moveDrag = useCallback((dx: number, dy: number) => {
    const m = dragState.current;
    m.delta = {x: dx, y: dy}; m.lastMoveAt = Date.now();
    const distance = origin.current * travel + (horizontal ? dx : dy);
    if (sheet) {
      pullPosition.current.upward = sheetPullDistance(Math.max(0, -distance), sheetPullLimits.upward);
      pullPosition.current.side = sheetPullDistance(sidewaysOrigin.current + (horizontal ? dy : dx), crossLimit);
      pull.setValue(pullPosition.current.upward);
      sideways.setValue(pullPosition.current.side);
    }
    const downward = sheet && m.returnOnly ? sheetPullDistance(Math.max(0, distance), m.returnLimit) : distance;
    position.current = Math.max(0, Math.min(1, downward / travel));
    progress.setValue(position.current);
  }, [crossLimit, horizontal, progress, pull, sheet, sideways, travel]);

  const releaseDrag = useCallback((dx: number, dy: number, vx: number, vy: number, cancelled: boolean) => {
    const m = dragState.current;
    const distance = Math.max(0, origin.current * travel + (horizontal ? dx : dy));
    const velocity = Date.now() - m.lastMoveAt > 100 ? 0 : horizontal ? vx : vy;
    const moved = Math.hypot(dx + m.captured.x, dy + m.captured.y) > 10;
    const back = !moved ? m.resumeClose : sheet
      ? shouldDismissSheet(sidewaysOrigin.current + (horizontal ? dy : dx), distance, velocity, travel)
      : velocity > -0.45 && (distance >= travel * 0.3 || (distance >= 24 && velocity >= 0.45));
    settle(!cancelled && !m.returnOnly && back);
  }, [horizontal, settle, sheet, travel]);

  const beginDrag = useCallback((dx = 0, dy = 0, returnOnly = false) => {
    const attempt = ++generation.current;
    const m = dragState.current;
    m.resumeClose = closing.current; m.captured = {x: dx, y: dy}; m.delta = {x: 0, y: 0};
    m.returnOnly = returnOnly;
    closing.current = false;
    dragging.current = true;
    cancelClick.current = true;
    Keyboard.dismiss();
    const setOrigin = (slide: number, upward: number, side: number) => {
      // Keep a returning/entering sheet at its displayed position when grabbed.
      m.returnLimit = Math.max(sheetPullLimits.upward, slide * travel * 2);
      const downward = sheet && returnOnly ? sheetPullOrigin(slide * travel, m.returnLimit) : slide * travel;
      origin.current = (downward + (horizontal ? dx : dy) - (sheet ? sheetPullOrigin(upward, sheetPullLimits.upward) : 0)) / travel;
      sidewaysOrigin.current = sheetPullOrigin(side, crossLimit) + (horizontal ? dy : dx);
    };
    setOrigin(position.current, pullPosition.current.upward, pullPosition.current.side);
    // A new touch takes ownership even during entrance, dismissal or recovery.
    stopAndRead([progress, pull, sideways], ([slide, upward, side]) => {
      if (attempt !== generation.current) return;
      setOrigin(slide!, upward!, side!);
      moveDrag(m.delta.x, m.delta.y);
    });
    moveDrag(0, 0);
  }, [crossLimit, horizontal, moveDrag, progress, pull, sheet, sideways, travel]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: (_, gesture) => {
      if (!canInteract() || !entered.current) return false;
      if (gesture.numberActiveTouches > 1) {multipleTouches.current = true; return false;}
      blocked.current = false;
      scroller.current = null;
      scrollHandoff.current.reset(0, 0);
      capturedSheetDrag.current = null;
      cancelClick.current = false;
      offAxis.current = false;
      dragging.current = false;
      multipleTouches.current = false;
      return false;
    },
    // Native Modal's wrapper otherwise takes unclaimed touches before move detection.
    onStartShouldSetPanResponder: () => canInteract() && entered.current && Platform.OS !== 'web' && !blocked.current && !scroller.current?.current.nativeGesture,
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      if (!canInteract() || !entered.current || blocked.current || scroller.current?.current.nativeGesture || offAxis.current || dragging.current || gesture.numberActiveTouches !== 1) return false;
      if (sheet) {
        if (Math.hypot(gesture.dx, gesture.dy) <= 10) return false;
        // Folder pages own horizontal travel; vertical scrolling and edge pulls
        // still belong to this sheet. Lock the axis for the rest of this touch.
        if (scroller.current?.current.horizontalGesture && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25) {
          offAxis.current = true;
          return false;
        }
        cancelClick.current = true;
        const claim = scrollHandoff.current.move(gesture.dx, gesture.dy, scroller.current?.current);
        if (claim) capturedSheetDrag.current = claim;
        return !!claim;
      }
      const along = gesture.dx;
      const across = Math.abs(gesture.dy);
      if (across > 10 && across > Math.abs(along)) {
        offAxis.current = true;
        return false;
      }
      const canGrab = (along > 10 || (position.current > 0 && along < -10)) && Math.abs(along) > across * 1.5;
      if (canGrab) capturedSheetDrag.current = {x: along, y: gesture.dy};
      return canGrab;
    },
    onPanResponderGrant: () => {
      if (!canInteract()) return;
      // PanResponder zeroes its deltas when taking over a child press. Preserve
      // the movement that claimed the sheet so short pulls do not have a dead zone.
      if (capturedSheetDrag.current) {
        beginDrag(capturedSheetDrag.current.x, capturedSheetDrag.current.y, capturedSheetDrag.current.returnOnly);
        moveDrag(0, 0);
      } else beginDrag();
    },
    onPanResponderStart: (_, gesture) => {if (gesture.numberActiveTouches > 1) multipleTouches.current = true;},
    onPanResponderMove: (_, gesture) => {
      if (gesture.numberActiveTouches > 1) multipleTouches.current = true;
      if (!canInteract() || blocked.current || scroller.current?.current.nativeGesture || offAxis.current || multipleTouches.current) return;
      const along = sheet ? gesture.dy : gesture.dx;
      if (!dragging.current) {
        if (sheet) {
          if (Math.hypot(gesture.dx, gesture.dy) <= 10) return;
          if (scroller.current?.current.horizontalGesture && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25) {offAxis.current = true; return;}
          const claim = scrollHandoff.current.move(gesture.dx, gesture.dy, scroller.current?.current);
          if (!claim) return;
          beginDrag(claim.x - gesture.dx, claim.y - gesture.dy, claim.returnOnly);
        } else {
          const across = Math.abs(gesture.dy);
          if (across > 10 && across > Math.abs(along)) {offAxis.current = true; return;}
          if ((along <= 10 && !(position.current > 0 && along < -10)) || Math.abs(along) <= across * 1.5) return;
        }
        if (!sheet) beginDrag();
      }
      moveDrag(gesture.dx, gesture.dy);
    },
    onPanResponderRelease: (_, gesture) => {
      if (!dragging.current) return;
      releaseDrag(gesture.dx, gesture.dy, gesture.vx, gesture.vy, multipleTouches.current);
    },
    onPanResponderTerminate: () => {if (canInteract() && dragging.current) settle(false);},
    onPanResponderTerminationRequest: () => !dragging.current,
    // Once a pan owns the touch, an outgoing panel's native ScrollView must
    // not cancel it while its pointer-events update reaches the UI thread.
    onShouldBlockNativeResponder: () => dragging.current && exitingPanels.current.size > 0,
  }), [beginDrag, canInteract, moveDrag, releaseDrag, settle, sheet]);

  const radius = (value: number) => progress.interpolate({inputRange: [0, 0.15, 1], outputRange: [0, value, value], extrapolate: 'clamp'});
  const sheetMotion: Animated.WithAnimatedObject<ViewStyle> = {transform: [
    {translateX: horizontal ? Animated.subtract(Animated.multiply(progress, travel), pull) : sideways},
    {translateY: horizontal ? sideways : Animated.subtract(Animated.multiply(progress, travel), pull)},
  ]};
  const content = <GestureGuard.Provider value={{blocked, sheet, scroller, panels, exitingPanels, canInteract, sheetDrag: {
    canStart: () => !fixed && sheet && canInteract() && entered.current && !blocked.current,
    begin: beginDrag, move: moveDrag, release: releaseDrag,
  }}}>
    <DragClickBoundary cancelClick={cancelClick}>
      <View ref={gestureView} testID={sheet ? 'settings-sheet-swipe' : 'settings-back-swipe'} pointerEvents={dismissing ? 'none' : 'auto'} accessibilityElementsHidden={dismissing} importantForAccessibility={dismissing ? 'no-hide-descendants' : 'auto'} style={[styles.root, inline && StyleSheet.absoluteFill]} {...(fixed ? {} : pan.panHandlers)} onAccessibilityEscape={active ? requestClose : undefined}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {backgroundColor: '#000000', opacity: fixed ? 0 : progress.interpolate({inputRange: [0, 1], outputRange: [sheet ? isDark ? 0.4 : 0.2 : 0.18, 0], extrapolate: 'clamp'})}]}/>
        <Animated.View testID={sheet ? 'settings-sheet-motion' : 'settings-page-motion'} style={[styles.surface, !fixed && !sheet && {
          borderTopLeftRadius: radius(corners.topLeft),
          borderTopRightRadius: radius(corners.topRight),
          borderBottomLeftRadius: radius(corners.bottomLeft),
          borderBottomRightRadius: radius(corners.bottomRight),
          transform: [{translateX: Animated.multiply(progress, travel)}],
        }]}>
          {children(close, fixed ? {} : sheetMotion)}
        </Animated.View>
      </View>
    </DragClickBoundary>
  </GestureGuard.Provider>;
  if (inline) return content;
  return <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onShow={() => {syncSystemBars(isDark); setShown(true); onShowRef.current?.();}} onRequestClose={requestClose}>
    <SheetGestureRoot><SafeAreaProvider>{content}</SafeAreaProvider></SheetGestureRoot>
  </Modal>;
}

const styles = StyleSheet.create({
  root: {flex: 1, overflow: 'hidden'},
  surface: {flex: 1, overflow: 'hidden'},
});
