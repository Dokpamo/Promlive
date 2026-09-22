import {createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject} from 'react';
import {AccessibilityInfo, Animated, Keyboard, Modal, PanResponder, Platform, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {selectionHaptic} from './selectionHaptic';
import {panelSpringForDistance, stopAndRead} from './panelAnimation';
import {useScreenCorners} from './useScreenCorners';
import {syncSystemBars, useAppearance} from '../features/appearance/AppAppearance';
import {DragClickBoundary} from './DragClickBoundary';
import {sheetPullDistance, sheetPullLimits, sheetPullOrigin, shouldDismissSheet, shouldScrollSheet, type SheetScrollState} from './sheetMotion';

const GestureGuard = createContext<{
  blocked: {current: boolean};
  sheet: boolean;
  scroller: {current: RefObject<SheetScrollState> | null};
  sheets: RefObject<Map<symbol, () => void>>;
  exitingSheets: RefObject<Set<symbol>>;
  canInteract: () => boolean;
} | null>(null);

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
export function SwipeBackModal({onClose, onDismissStart, onBackRequest, children, sheet = false, sheetHeight = 0, active = true}: {
  onClose: () => void;
  onDismissStart?: () => void;
  onBackRequest?: () => boolean;
  children: (close: () => void, motionStyle: Animated.WithAnimatedObject<ViewStyle>) => ReactNode;
  sheet?: boolean;
  sheetHeight?: number;
  active?: boolean;
}) {
  const {isDark} = useAppearance();
  const parentGuard = useContext(GestureGuard);
  const parentSheets = parentGuard?.sheets;
  const parentExitingSheets = parentGuard?.exitingSheets;
  // A second native Modal owns the entire window until it unmounts, even when
  // its view ignores touches. Keep sheets in the page's window for immediate handoff.
  const inline = sheet && parentSheets !== undefined;
  const sheetId = useRef(Symbol('settings-sheet')).current;
  const sheets = useRef(new Map<symbol, () => void>());
  const exitingSheets = useRef(new Set<symbol>());
  const {width, height} = useWindowDimensions();
  const travel = sheet ? sheetHeight || height : width;
  const corners = useScreenCorners();
  const progress = useRef(new Animated.Value(1)).current;
  const pull = useRef(new Animated.Value(0)).current;
  const sideways = useRef(new Animated.Value(0)).current;
  const sidewaysOrigin = useRef(0);
  const position = useRef(1);
  const pullPosition = useRef({upward: 0, side: 0});
  const origin = useRef(1);
  const blocked = useRef(false);
  const scroller = useRef<RefObject<SheetScrollState> | null>(null);
  const scrolling = useRef(false);
  const capturedSheetDrag = useRef<{x: number; y: number} | null>(null);
  const cancelClick = useRef(false);
  const offAxis = useRef(false);
  const dragging = useRef(false);
  const multipleTouches = useRef(false);
  const closing = useRef(false);
  const finalized = useRef(false);
  const generation = useRef(0);
  const dragState = useRef({resumeClose: false, captured: {x: 0, y: 0}, delta: {x: 0, y: 0}, lastMoveAt: 0});
  const entered = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onDismissStartRef = useRef(onDismissStart);
  onDismissStartRef.current = onDismissStart;
  const onBackRequestRef = useRef(onBackRequest);
  onBackRequestRef.current = onBackRequest;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [shown, setShown] = useState(inline);
  const [sheetDismissing, setSheetDismissing] = useState(false);

  const canInteract = useCallback(() => active && !finalized.current && !(sheet && closing.current) && sheets.current.size === 0, [active, sheet]);

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
    if (sheet) {
      // The exit spring stays visible, but the next touch belongs to the page.
      if (back) {
        parentSheets?.current.delete(sheetId);
        parentExitingSheets?.current.add(sheetId);
      }
      setSheetDismissing(back);
    }
    if (back) {
      Keyboard.dismiss();
      selectionHaptic();
    }
    const finish = () => {
      if (attempt !== generation.current || finalized.current) return;
      position.current = back ? 1 : 0;
      if (back) {finalized.current = true; onCloseRef.current();}
    };
    if (reduceMotion) {
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
  }, [parentExitingSheets, parentSheets, progress, pull, reduceMotion, sheet, sheetId, sideways, travel]);
  const close = useCallback(() => {if (!closing.current) settle(true);}, [settle]);
  const requestClose = useCallback(() => {
    const topSheet = Array.from(sheets.current.values()).at(-1);
    if (topSheet) topSheet(); else if (!onBackRequestRef.current?.()) close();
  }, [close]);

  useLayoutEffect(() => {
    if (!inline || sheetDismissing) return;
    parentSheets.current.set(sheetId, requestClose);
    return () => {parentSheets.current.delete(sheetId);};
  }, [requestClose, inline, parentSheets, sheetDismissing, sheetId]);
  useLayoutEffect(() => () => {parentExitingSheets?.current.delete(sheetId);}, [parentExitingSheets, sheetId]);

  useEffect(() => {
    if (!shown || (sheet && !sheetHeight) || reduceMotion === null || entered.current || closing.current) return;
    entered.current = true;
    settle(false);
  }, [reduceMotion, settle, sheet, sheetHeight, shown]);

  const moveDrag = useCallback((dx: number, dy: number) => {
    const m = dragState.current;
    m.delta = {x: dx, y: dy}; m.lastMoveAt = Date.now();
    const distance = origin.current * travel + (sheet ? dy : dx);
    if (sheet) {
      pullPosition.current.upward = sheetPullDistance(Math.max(0, -distance), sheetPullLimits.upward);
      pullPosition.current.side = sheetPullDistance(sidewaysOrigin.current + dx, sheetPullLimits.sideways);
      pull.setValue(pullPosition.current.upward);
      sideways.setValue(pullPosition.current.side);
    }
    position.current = Math.max(0, Math.min(1, distance / travel));
    progress.setValue(position.current);
  }, [progress, pull, sheet, sideways, travel]);

  const releaseDrag = useCallback((dx: number, dy: number, vx: number, vy: number, cancelled: boolean) => {
    const m = dragState.current;
    const distance = Math.max(0, origin.current * travel + (sheet ? dy : dx));
    const velocity = Date.now() - m.lastMoveAt > 100 ? 0 : sheet ? vy : vx;
    const moved = Math.hypot(dx + m.captured.x, dy + m.captured.y) > 10;
    const back = !moved ? m.resumeClose : sheet
      ? shouldDismissSheet(sidewaysOrigin.current + dx, distance, velocity, travel)
      : velocity > -0.45 && (distance >= travel * 0.3 || (distance >= 24 && velocity >= 0.45));
    settle(!cancelled && back);
  }, [settle, sheet, travel]);

  const beginDrag = useCallback((dx = 0, dy = 0) => {
    const attempt = ++generation.current;
    const m = dragState.current;
    m.resumeClose = closing.current; m.captured = {x: dx, y: dy}; m.delta = {x: 0, y: 0};
    closing.current = false;
    dragging.current = true;
    cancelClick.current = true;
    Keyboard.dismiss();
    const setOrigin = (slide: number, upward: number, side: number) => {
      origin.current = slide + (sheet ? dy - sheetPullOrigin(upward, sheetPullLimits.upward) : dx) / travel;
      sidewaysOrigin.current = sheetPullOrigin(side, sheetPullLimits.sideways) + dx;
    };
    setOrigin(position.current, pullPosition.current.upward, pullPosition.current.side);
    // A new touch takes ownership even during entrance, dismissal or recovery.
    stopAndRead([progress, pull, sideways], ([slide, upward, side]) => {
      if (attempt !== generation.current) return;
      setOrigin(slide!, upward!, side!);
      moveDrag(m.delta.x, m.delta.y);
    });
    moveDrag(0, 0);
  }, [moveDrag, progress, pull, sheet, sideways, travel]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: (_, gesture) => {
      if (!canInteract() || !entered.current) return false;
      if (gesture.numberActiveTouches > 1) {multipleTouches.current = true; return false;}
      blocked.current = false;
      scroller.current = null;
      scrolling.current = false;
      capturedSheetDrag.current = null;
      cancelClick.current = false;
      offAxis.current = false;
      dragging.current = false;
      multipleTouches.current = false;
      return false;
    },
    // Native Modal's wrapper otherwise takes unclaimed touches before move detection.
    onStartShouldSetPanResponder: () => canInteract() && entered.current && Platform.OS !== 'web' && !blocked.current,
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      if (!canInteract() || !entered.current || blocked.current || scrolling.current || offAxis.current || dragging.current || gesture.numberActiveTouches !== 1) return false;
      if (sheet) {
        if (Math.hypot(gesture.dx, gesture.dy) <= 10) return false;
        scrolling.current = shouldScrollSheet(scroller.current?.current, gesture.dx, gesture.dy);
        cancelClick.current = true;
        if (!scrolling.current) capturedSheetDrag.current = {x: gesture.dx, y: gesture.dy};
        return !scrolling.current;
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
        beginDrag(capturedSheetDrag.current.x, capturedSheetDrag.current.y);
        moveDrag(0, 0);
      } else beginDrag();
    },
    onPanResponderStart: (_, gesture) => {if (gesture.numberActiveTouches > 1) multipleTouches.current = true;},
    onPanResponderMove: (_, gesture) => {
      if (gesture.numberActiveTouches > 1) multipleTouches.current = true;
      if (!canInteract() || blocked.current || scrolling.current || offAxis.current || multipleTouches.current) return;
      const along = sheet ? gesture.dy : gesture.dx;
      if (!dragging.current) {
        if (sheet) {
          if (Math.hypot(gesture.dx, gesture.dy) <= 10) return;
          scrolling.current = shouldScrollSheet(scroller.current?.current, gesture.dx, gesture.dy);
          if (scrolling.current) return;
        } else {
          const across = Math.abs(gesture.dy);
          if (across > 10 && across > Math.abs(along)) {offAxis.current = true; return;}
          if ((along <= 10 && !(position.current > 0 && along < -10)) || Math.abs(along) <= across * 1.5) return;
        }
        beginDrag();
      }
      moveDrag(gesture.dx, gesture.dy);
    },
    onPanResponderRelease: (_, gesture) => {
      if (!dragging.current) return;
      releaseDrag(gesture.dx, gesture.dy, gesture.vx, gesture.vy, multipleTouches.current);
    },
    onPanResponderTerminate: () => {if (canInteract()) settle(false);},
    onPanResponderTerminationRequest: () => !dragging.current,
    // Once a pan owns the touch, the outgoing sheet's native ScrollView must
    // not cancel it while its pointer-events update reaches the UI thread.
    onShouldBlockNativeResponder: () => dragging.current && exitingSheets.current.size > 0,
  }), [beginDrag, canInteract, moveDrag, releaseDrag, settle, sheet]);

  const radius = (value: number) => progress.interpolate({inputRange: [0, 0.15, 1], outputRange: [0, value, value], extrapolate: 'clamp'});
  const sheetMotion: Animated.WithAnimatedObject<ViewStyle> = {transform: [
    {translateX: sideways},
    {translateY: Animated.subtract(Animated.multiply(progress, travel), pull)},
  ]};
  const content = <GestureGuard.Provider value={{blocked, sheet, scroller, sheets, exitingSheets, canInteract}}>
    <DragClickBoundary cancelClick={cancelClick}>
      <View testID={sheet ? 'settings-sheet-swipe' : 'settings-back-swipe'} pointerEvents={sheetDismissing ? 'none' : 'auto'} accessibilityElementsHidden={sheetDismissing} importantForAccessibility={sheetDismissing ? 'no-hide-descendants' : 'auto'} style={[styles.root, inline && StyleSheet.absoluteFill]} {...pan.panHandlers} onAccessibilityEscape={active ? requestClose : undefined}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {backgroundColor: '#000000', opacity: progress.interpolate({inputRange: [0, 1], outputRange: [sheet ? isDark ? 0.4 : 0.2 : 0.18, 0], extrapolate: 'clamp'})}]}/>
        <Animated.View testID={sheet ? 'settings-sheet-motion' : 'settings-page-motion'} style={[styles.surface, !sheet && {
          borderTopLeftRadius: radius(corners.topLeft),
          borderTopRightRadius: radius(corners.topRight),
          borderBottomLeftRadius: radius(corners.bottomLeft),
          borderBottomRightRadius: radius(corners.bottomRight),
          transform: [{translateX: Animated.multiply(progress, travel)}],
        }]}>
          {children(close, sheetMotion)}
        </Animated.View>
      </View>
    </DragClickBoundary>
  </GestureGuard.Provider>;
  if (inline) return content;
  return <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onShow={() => {syncSystemBars(isDark); setShown(true);}} onRequestClose={requestClose}>
    <SafeAreaProvider>{content}</SafeAreaProvider>
  </Modal>;
}

const styles = StyleSheet.create({
  root: {flex: 1, overflow: 'hidden'},
  surface: {flex: 1, overflow: 'hidden'},
});
