import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {AccessibilityInfo, Animated, Keyboard, Modal, PanResponder, Platform, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {selectionHaptic} from '../chat/selectionHaptic';
import {panelSpring} from '../chat/usePanelMotion';
import {useScreenCorners} from '../chat/useScreenCorners';
import {syncSystemBars, useAppearance} from '../appearance/AppAppearance';

const GestureGuard = createContext<{current: boolean} | null>(null);

/** Keep horizontal editing and switch gestures inside their own controls. */
export function SwipeBackBoundary({children, style}: {children: ReactNode; style?: StyleProp<ViewStyle>}) {
  const guard = useContext(GestureGuard);
  return <View style={style} onStartShouldSetResponderCapture={() => {if (guard) guard.current = true; return false;}}>{children}</View>;
}

/** Keep the initial responder inside the native scroller so it can scroll vertically. */
export function SwipeBackScrollContent({children}: {children: ReactNode}) {
  return <View onStartShouldSetResponder={() => Platform.OS !== 'web'} onResponderGrant={() => false} onResponderTerminationRequest={() => true}>{children}</View>;
}

/** A transparent modal keeps the previous screen visible beneath a back swipe. */
export function SwipeBackModal({onClose, children, sheet = false, active = true}: {
  onClose: () => void;
  children: (close: () => void) => ReactNode;
  sheet?: boolean;
  active?: boolean;
}) {
  const {isDark} = useAppearance();
  const {width} = useWindowDimensions();
  const corners = useScreenCorners();
  const progress = useRef(new Animated.Value(1)).current;
  const position = useRef(1);
  const origin = useRef(1);
  const blocked = useRef(false);
  const vertical = useRef(false);
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
    return () => {progress.stopAnimation(); progress.removeListener(listener);};
  }, [progress]);

  useEffect(() => {
    if (!shown || reduceMotion === null || entered.current || closing.current) return;
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
  }, [progress, reduceMotion, shown]);

  const settle = useCallback((back: boolean) => {
    if (closing.current) return;
    progress.stopAnimation();
    if (back) {
      closing.current = true;
      Keyboard.dismiss();
      selectionHaptic();
    }
    if (reduceMotion) {
      progress.setValue(back ? 1 : 0);
      if (back) onCloseRef.current();
      return;
    }
    Animated.spring(progress, {
      ...panelSpring,
      toValue: back ? 1 : 0,
      useNativeDriver: Platform.OS !== 'web',
    }).start(({finished}) => {if (finished && back) onCloseRef.current();});
  }, [progress, reduceMotion]);
  const close = useCallback(() => settle(true), [settle]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: (_, gesture) => {
      if (!active || opening.current) return false;
      if (gesture.numberActiveTouches > 1) {multipleTouches.current = true; return false;}
      blocked.current = false;
      vertical.current = false;
      dragging.current = false;
      multipleTouches.current = false;
      return false;
    },
    // Native Modal's wrapper otherwise takes unclaimed touches before move detection.
    onStartShouldSetPanResponder: () => active && !opening.current && Platform.OS !== 'web' && !blocked.current && !closing.current,
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      if (!active || opening.current || blocked.current || vertical.current || closing.current || gesture.numberActiveTouches !== 1) return false;
      const x = Math.abs(gesture.dx);
      const y = Math.abs(gesture.dy);
      if (y > 10 && y > x) {vertical.current = true; return false;}
      return gesture.dx > 10 && x > y * 1.5;
    },
    onPanResponderGrant: () => {
      origin.current = position.current;
    },
    onPanResponderStart: (_, gesture) => {if (gesture.numberActiveTouches > 1) multipleTouches.current = true;},
    onPanResponderMove: (_, gesture) => {
      if (gesture.numberActiveTouches > 1) multipleTouches.current = true;
      if (!active || blocked.current || vertical.current || multipleTouches.current || closing.current) return;
      if (!dragging.current) {
        const x = Math.abs(gesture.dx);
        const y = Math.abs(gesture.dy);
        if (y > 10 && y > x) {vertical.current = true; return;}
        if (gesture.dx <= 10 || x <= y * 1.5) return;
        progress.stopAnimation();
        origin.current = position.current;
        dragging.current = true;
        Keyboard.dismiss();
      }
      progress.setValue(Math.max(0, Math.min(1, origin.current + gesture.dx / width)));
    },
    onPanResponderRelease: (_, gesture) => {
      if (!dragging.current) return;
      const distance = Math.max(0, origin.current * width + gesture.dx);
      const back = gesture.vx > -0.45 && (distance >= width * 0.3 || (distance >= 24 && gesture.vx >= 0.45));
      settle(!multipleTouches.current && back);
    },
    onPanResponderTerminate: () => settle(false),
    onPanResponderTerminationRequest: () => !dragging.current,
    onShouldBlockNativeResponder: () => false,
  }), [active, progress, settle, width]);

  const radius = (value: number) => progress.interpolate({inputRange: [0, 0.15, 1], outputRange: [0, value, value], extrapolate: 'clamp'});
  return <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onShow={() => {syncSystemBars(isDark); setShown(true);}} onRequestClose={close}>
    <SafeAreaProvider>
      <GestureGuard.Provider value={blocked}>
        <View testID={sheet ? 'settings-sheet-swipe' : 'settings-back-swipe'} style={styles.root} {...pan.panHandlers} onAccessibilityEscape={active ? close : undefined}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {backgroundColor: '#000000', opacity: progress.interpolate({inputRange: [0, 1], outputRange: [sheet ? 0.58 : 0.18, 0], extrapolate: 'clamp'})}]}/>
          <Animated.View style={[styles.surface, !sheet && {
            borderTopLeftRadius: radius(corners.topLeft),
            borderTopRightRadius: radius(corners.topRight),
            borderBottomLeftRadius: radius(corners.bottomLeft),
            borderBottomRightRadius: radius(corners.bottomRight),
          }, {transform: [{translateX: Animated.multiply(progress, width)}]}]}>
            {children(close)}
          </Animated.View>
        </View>
      </GestureGuard.Provider>
    </SafeAreaProvider>
  </Modal>;
}

const styles = StyleSheet.create({
  root: {flex: 1, overflow: 'hidden'},
  surface: {flex: 1, overflow: 'hidden'},
});
