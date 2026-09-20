import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject} from 'react';
import {AccessibilityInfo, Animated, Keyboard, Modal, PanResponder, Platform, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {selectionHaptic} from '../chat/selectionHaptic';
import {panelSpring} from '../chat/usePanelMotion';
import {useScreenCorners} from '../chat/useScreenCorners';
import {syncSystemBars, useAppearance} from '../appearance/AppAppearance';
import {DragClickBoundary} from './DragClickBoundary';
import {sheetPullDistance, sheetPullLimits, sheetPullOrigin, shouldDismissSheet, shouldScrollSheet, type SheetScrollState} from './sheetMotion';

const GestureGuard = createContext<{blocked: {current: boolean}; sheet: boolean; scroller: {current: RefObject<SheetScrollState> | null}} | null>(null);

/** Keep horizontal editing and switch gestures inside their own controls. */
export function SwipeBackBoundary({children, style}: {children: ReactNode; style?: StyleProp<ViewStyle>}) {
  const guard = useContext(GestureGuard);
  return <View style={style} onStartShouldSetResponderCapture={() => {if (guard) guard.blocked.current = true; return false;}}>{children}</View>;
}

/** Keep the initial responder inside the native scroller so it can scroll vertically. */
export function SwipeBackScrollContent({children, sheetScroll}: {children: ReactNode; sheetScroll?: RefObject<SheetScrollState>}) {
  const guard = useContext(GestureGuard);
  return <View onStartShouldSetResponderCapture={() => {if (guard?.sheet) guard.scroller.current = sheetScroll ?? null; return false;}} onStartShouldSetResponder={() => Platform.OS !== 'web'} onResponderGrant={() => false} onResponderTerminationRequest={() => true}>{children}</View>;
}

/** A transparent modal keeps the previous screen visible beneath a back swipe. */
export function SwipeBackModal({onClose, children, sheet = false, sheetHeight = 0, active = true}: {
  onClose: () => void;
  children: (close: () => void, motionStyle: Animated.WithAnimatedObject<ViewStyle>) => ReactNode;
  sheet?: boolean;
  sheetHeight?: number;
  active?: boolean;
}) {
  const {isDark} = useAppearance();
  const {width, height} = useWindowDimensions();
  const travel = sheet ? sheetHeight || height : width;
  const corners = useScreenCorners();
  const progress = useRef(new Animated.Value(1)).current;
  const pull = useRef(new Animated.Value(0)).current;
  const sideways = useRef(new Animated.Value(0)).current;
  const pullPosition = useRef(0);
  const sidewaysPosition = useRef(0);
  const sidewaysOrigin = useRef(0);
  const position = useRef(1);
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
  const opening = useRef(true);
  const entered = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {if (mounted) setReduceMotion(value);});
    const change = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {mounted = false; change.remove();};
  }, []);

  useEffect(() => {
    const listener = progress.addListener(({value}) => {position.current = value;});
    const pullListener = pull.addListener(({value}) => {pullPosition.current = value;});
    const sidewaysListener = sideways.addListener(({value}) => {sidewaysPosition.current = value;});
    return () => {
      progress.stopAnimation(); progress.removeListener(listener);
      pull.stopAnimation(); pull.removeListener(pullListener);
      sideways.stopAnimation(); sideways.removeListener(sidewaysListener);
    };
  }, [progress, pull, sideways]);

  useEffect(() => {
    if (!shown || (sheet && !sheetHeight) || reduceMotion === null || entered.current || closing.current) return;
    entered.current = true;
    if (reduceMotion) {
      progress.setValue(0);
      opening.current = false;
      return;
    }
    Animated.spring(progress, {
      ...panelSpring, toValue: 0,
      useNativeDriver: Platform.OS !== 'web',
    }).start(({finished}) => {if (finished) opening.current = false;});
  }, [progress, reduceMotion, sheet, sheetHeight, shown]);

  const settle = useCallback((back: boolean) => {
    if (closing.current) return;
    progress.stopAnimation();
    pull.stopAnimation();
    sideways.stopAnimation();
    if (back) {
      closing.current = true;
      Keyboard.dismiss();
      selectionHaptic();
    }
    if (reduceMotion) {
      progress.setValue(back ? 1 : 0);
      pull.setValue(0);
      sideways.setValue(0);
      if (back) onCloseRef.current();
      return;
    }
    const slide = Animated.spring(progress, {
      ...panelSpring,
      toValue: back ? 1 : 0,
      useNativeDriver: Platform.OS !== 'web',
    });
    const animation = sheet ? Animated.parallel([
      slide,
      Animated.spring(pull, {...panelSpring, toValue: 0, useNativeDriver: Platform.OS !== 'web'}),
      Animated.spring(sideways, {...panelSpring, toValue: 0, useNativeDriver: Platform.OS !== 'web'}),
    ]) : slide;
    animation.start(({finished}) => {if (finished && back) onCloseRef.current();});
  }, [progress, pull, reduceMotion, sheet, sideways]);
  const close = useCallback(() => settle(true), [settle]);

  const beginDrag = useCallback((dx = 0, dy = 0) => {
    progress.stopAnimation();
    pull.stopAnimation();
    sideways.stopAnimation();
    origin.current = position.current + (sheet ? (dy - sheetPullOrigin(pullPosition.current, sheetPullLimits.upward)) / travel : 0);
    sidewaysOrigin.current = sheetPullOrigin(sidewaysPosition.current, sheetPullLimits.sideways) + dx;
    dragging.current = true;
    if (sheet) cancelClick.current = true;
    Keyboard.dismiss();
  }, [progress, pull, sheet, sideways, travel]);

  const moveDrag = useCallback((dx: number, dy: number) => {
    const distance = origin.current * travel + (sheet ? dy : dx);
    if (sheet) {
      pull.setValue(sheetPullDistance(Math.max(0, -distance), sheetPullLimits.upward));
      sideways.setValue(sheetPullDistance(sidewaysOrigin.current + dx, sheetPullLimits.sideways));
    }
    progress.setValue(Math.max(0, Math.min(1, distance / travel)));
  }, [progress, pull, sheet, sideways, travel]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: (_, gesture) => {
      if (!active || opening.current) return false;
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
    onStartShouldSetPanResponder: () => active && !opening.current && Platform.OS !== 'web' && !blocked.current && !closing.current,
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      if (!active || opening.current || blocked.current || scrolling.current || offAxis.current || dragging.current || closing.current || gesture.numberActiveTouches !== 1) return false;
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
      return along > 10 && along > across * 1.5;
    },
    onPanResponderGrant: () => {
      // PanResponder zeroes its deltas when taking over a child press. Preserve
      // the movement that claimed the sheet so short pulls do not have a dead zone.
      if (sheet && capturedSheetDrag.current) {
        beginDrag(capturedSheetDrag.current.x, capturedSheetDrag.current.y);
        moveDrag(0, 0);
      }
    },
    onPanResponderStart: (_, gesture) => {if (gesture.numberActiveTouches > 1) multipleTouches.current = true;},
    onPanResponderMove: (_, gesture) => {
      if (gesture.numberActiveTouches > 1) multipleTouches.current = true;
      if (!active || blocked.current || scrolling.current || offAxis.current || multipleTouches.current || closing.current) return;
      const along = sheet ? gesture.dy : gesture.dx;
      if (!dragging.current) {
        if (sheet) {
          if (Math.hypot(gesture.dx, gesture.dy) <= 10) return;
          scrolling.current = shouldScrollSheet(scroller.current?.current, gesture.dx, gesture.dy);
          if (scrolling.current) return;
        } else {
          const across = Math.abs(gesture.dy);
          if (across > 10 && across > Math.abs(along)) {offAxis.current = true; return;}
          if (along <= 10 || along <= across * 1.5) return;
        }
        beginDrag();
      }
      moveDrag(gesture.dx, gesture.dy);
    },
    onPanResponderRelease: (_, gesture) => {
      if (!dragging.current) return;
      const distance = Math.max(0, origin.current * travel + (sheet ? gesture.dy : gesture.dx));
      const velocity = sheet ? gesture.vy : gesture.vx;
      const back = sheet
        ? shouldDismissSheet(sidewaysOrigin.current + gesture.dx, distance, velocity, travel)
        : velocity > -0.45 && (distance >= travel * 0.3 || (distance >= 24 && velocity >= 0.45));
      settle(!multipleTouches.current && back);
    },
    onPanResponderTerminate: () => settle(false),
    onPanResponderTerminationRequest: () => !dragging.current,
    onShouldBlockNativeResponder: () => false,
  }), [active, beginDrag, moveDrag, settle, sheet, travel]);

  const radius = (value: number) => progress.interpolate({inputRange: [0, 0.15, 1], outputRange: [0, value, value], extrapolate: 'clamp'});
  const sheetMotion: Animated.WithAnimatedObject<ViewStyle> = {transform: [
    {translateX: sideways},
    {translateY: Animated.subtract(Animated.multiply(progress, travel), pull)},
  ]};
  return <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onShow={() => {syncSystemBars(isDark); setShown(true);}} onRequestClose={close}>
    <SafeAreaProvider>
      <GestureGuard.Provider value={{blocked, sheet, scroller}}>
        <DragClickBoundary cancelClick={cancelClick}>
        <View testID={sheet ? 'settings-sheet-swipe' : 'settings-back-swipe'} style={styles.root} {...pan.panHandlers} onAccessibilityEscape={active ? close : undefined}>
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
      </GestureGuard.Provider>
    </SafeAreaProvider>
  </Modal>;
}

const styles = StyleSheet.create({
  root: {flex: 1, overflow: 'hidden'},
  surface: {flex: 1, overflow: 'hidden'},
});
