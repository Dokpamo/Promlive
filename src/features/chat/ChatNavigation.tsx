import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {AccessibilityInfo, Animated, BackHandler, Keyboard, PanResponder, Platform, StyleSheet, View, useWindowDimensions} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';
import {DrawerGestureGuard, DrawerModalLocks} from './DrawerGestureBoundary';
import {DragClickBoundary} from '../../layout/DragClickBoundary';
import {useScreenCorners} from '../../layout/useScreenCorners';
import {usePanelMotion} from './usePanelMotion';

type Panel = 'back' | 'pocket';

/** A room returns to its collection on the left and keeps its pocket on the right. */
export function ChatNavigation({children, pocketContent, onExit, report, routeKey, active = true, handlesBack = false, pocketEnabled = true}: {
  children: (navigation: {back: () => boolean; close: () => void; openPocket: () => void}) => ReactNode;
  pocketContent: (close: () => void) => ReactNode;
  onExit: () => void | Promise<void>;
  report: (error: unknown) => void;
  routeKey: string;
  active?: boolean;
  handlesBack?: boolean;
  pocketEnabled?: boolean;
}) {
  const {colors: c} = useAppearance();
  const {width} = useWindowDimensions();
  const corners = useScreenCorners();
  const [reduceMotion, setReduceMotion] = useState(false);
  const blocked = useRef(false);
  const modalLocks = useRef(0);
  const cancelClick = useRef(false);
  const vertical = useRef(false);
  const multiTouch = useRef(false);
  const gesturePanel = useRef<Panel | null>(null);
  const startingPanel = useRef<Panel | null>(null);
  const capturedDrag = useRef(0);
  const leaving = useRef(false);
  const mounted = useRef(false);
  const commitExit = useRef(() => {});
  const returning = usePanelMotion(reduceMotion, width, open => {if (open) commitExit.current();});
  const pocket = usePanelMotion(reduceMotion, width);
  const panels = useRef({back: returning, pocket});
  panels.current = {back: returning, pocket};
  commitExit.current = () => {
    if (leaving.current) return;
    leaving.current = true;
    void Promise.resolve().then(onExit).catch(error => {
      if (!mounted.current) return;
      leaving.current = false;
      returning.settle(false);
      report(error);
    });
  };
  useEffect(() => {
    mounted.current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {if (mounted.current) setReduceMotion(value);});
    const change = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {mounted.current = false; change.remove();};
  }, []);
  useEffect(() => {returning.reset(); pocket.reset(); leaving.current = false;}, [routeKey, returning.reset, pocket.reset]);
  useEffect(() => {if (!pocketEnabled) pocket.reset();}, [pocketEnabled, pocket.reset]);

  const back = useCallback(() => {
    if (!active || modalLocks.current || leaving.current) return false;
    if (panels.current.pocket.visible) {panels.current.pocket.settle(false); return true;}
    return false;
  }, [active]);
  const close = useCallback(() => {
    if (active && !modalLocks.current && !leaving.current) panels.current.back.settle(true);
  }, [active]);
  const openPocket = useCallback(() => {
    if (active && pocketEnabled && !modalLocks.current && !leaving.current) {
      panels.current.back.reset(); panels.current.pocket.settle(true);
    }
  }, [active, pocketEnabled]);
  const requestBack = useCallback(() => {
    if (!active || modalLocks.current || leaving.current) return false;
    if (back()) return true;
    if (handlesBack) return false;
    if (Keyboard.isVisible()) Keyboard.dismiss(); else close();
    return true;
  }, [active, back, close, handlesBack]);
  useEffect(() => {
    if (!active) return;
    if (Platform.OS === 'android') {
      const subscription = BackHandler.addEventListener('hardwareBackPress', requestBack);
      return () => subscription.remove();
    }
    if (Platform.OS === 'web') {
      const escape = (event: KeyboardEvent) => {if (event.key === 'Escape' && requestBack()) event.preventDefault();};
      document.addEventListener('keydown', escape);
      return () => document.removeEventListener('keydown', escape);
    }
    return undefined;
  }, [active, requestBack]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: (_, gesture) => {
      if (!active || modalLocks.current || leaving.current) return false;
      if (gesture.numberActiveTouches > 1) {multiTouch.current = true; return false;}
      blocked.current = false; cancelClick.current = false; vertical.current = false; multiTouch.current = false;
      gesturePanel.current = null; capturedDrag.current = 0;
      startingPanel.current = panels.current.pocket.visible ? 'pocket' : panels.current.back.visible ? 'back' : null;
      return false;
    },
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      if (!active || modalLocks.current || leaving.current || blocked.current || vertical.current || gesturePanel.current || gesture.numberActiveTouches !== 1) return false;
      const x = Math.abs(gesture.dx), y = Math.abs(gesture.dy);
      if (y > 10 && y > x) {vertical.current = true; return false;}
      if (x < 10 || x < y * 1.5) return false;
      // A gesture that began in the pocket only closes the pocket, even if
      // the same finger keeps moving past the chat's edge.
      const next = startingPanel.current ?? (gesture.dx > 0 ? 'back' : pocketEnabled ? 'pocket' : null);
      if (!next || (next === 'pocket' && panels.current.pocket.position.current >= 1 && gesture.dx < 0)) return false;
      gesturePanel.current = next; capturedDrag.current = gesture.dx;
      return true;
    },
    onPanResponderGrant: () => {
      const key = gesturePanel.current;
      if (!key || modalLocks.current) return;
      cancelClick.current = true;
      panels.current[key].begin(capturedDrag.current * (key === 'pocket' ? -1 : 1) / width);
    },
    onPanResponderStart: (_, gesture) => {if (gesture.numberActiveTouches > 1) multiTouch.current = true;},
    onPanResponderMove: (_, gesture) => {
      if (gesture.numberActiveTouches > 1) multiTouch.current = true;
      const key = gesturePanel.current;
      if (!key || modalLocks.current || multiTouch.current) return;
      panels.current[key].move(gesture.dx * (key === 'pocket' ? -1 : 1) / width);
    },
    onPanResponderRelease: (_, gesture) => {
      const key = gesturePanel.current; gesturePanel.current = null;
      if (!key) return;
      panels.current[key].release(gesture.dx * (key === 'pocket' ? -1 : 1) / width, gesture.vx * (key === 'pocket' ? -1 : 1), multiTouch.current || modalLocks.current > 0);
    },
    onPanResponderTerminate: () => {
      const key = gesturePanel.current; gesturePanel.current = null;
      if (key) panels.current[key].settle(panels.current[key].target.current);
    },
    onPanResponderTerminationRequest: () => false,
  }), [active, pocketEnabled, width]);
  const pageRadius = (radius: number) => pocket.progress.interpolate({inputRange: [0, 0.15, 0.85, 1], outputRange: [0, radius, radius, 0], extrapolate: 'clamp'});
  return <DrawerModalLocks.Provider value={modalLocks}><DrawerGestureGuard.Provider value={blocked}><DragClickBoundary cancelClick={cancelClick}>
    <Animated.View testID="chat-navigation" {...pan.panHandlers} onAccessibilityEscape={requestBack}
      style={[StyleSheet.absoluteFill, {overflow: 'hidden', backgroundColor: c.background, transform: [{translateX: Animated.multiply(returning.progress, width)}]}]}>
      <Animated.View testID="chat-pocket-pages" style={{position: 'absolute', top: 0, bottom: 0, left: 0, width: pocketEnabled ? width * 2 : width, overflow: 'hidden', backgroundColor: c.background,
        borderTopLeftRadius: pageRadius(corners.topLeft), borderTopRightRadius: pageRadius(corners.topRight), borderBottomLeftRadius: pageRadius(corners.bottomLeft), borderBottomRightRadius: pageRadius(corners.bottomRight),
        transform: [{translateX: Animated.multiply(pocket.progress, -width)}]}}>
        <View testID="chat-page" pointerEvents={pocket.visible ? 'none' : 'auto'} aria-hidden={pocket.visible} accessibilityElementsHidden={pocket.visible} importantForAccessibility={pocket.visible ? 'no-hide-descendants' : 'auto'}
          style={{position: 'absolute', top: 0, bottom: 0, left: 0, width}}>{children({back, close, openPocket})}</View>
        {pocketEnabled && pocket.visible && <View testID="pocket-page" onAccessibilityEscape={() => pocket.settle(false)} style={{position: 'absolute', top: 0, bottom: 0, left: width, width}}>{pocketContent(() => pocket.settle(false))}</View>}
      </Animated.View>
    </Animated.View>
  </DragClickBoundary></DrawerGestureGuard.Provider></DrawerModalLocks.Provider>;
}
