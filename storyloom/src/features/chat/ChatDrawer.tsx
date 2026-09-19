import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {AccessibilityInfo, Animated, BackHandler, Keyboard, PanResponder, Platform, Pressable, StyleSheet, View, useWindowDimensions} from 'react-native';
import type {Workspace} from '../../app/workspace';
import {ChatHistory} from './ChatHistory';
import {useAppearance} from '../appearance/AppAppearance';
import {drawerProgress, shouldOpenDrawer} from './drawerMotion';
import {useScreenCorners} from './useScreenCorners';
import {DrawerGestureGuard} from './DrawerGestureBoundary';
import {selectionHaptic} from './selectionHaptic';

const openScale = 0.90;
// Blend toward the history: dark #111 -> #1A, light #FFF -> #F9.
const previewScrimOpacity = 0.61;

export function ChatDrawer({workspace, children, openSettings, active = true}: {workspace: Workspace; children: (open: () => void) => ReactNode; openSettings: () => void; active?: boolean}) {
  const {colors: c, isDark} = useAppearance();
  const {width} = useWindowDimensions();
  const drawerWidth = Math.min(width * 0.84, 400);
  const corners = useScreenCorners();
  const progress = useRef(new Animated.Value(0)).current;
  const position = useRef(0);
  const origin = useRef(0);
  const target = useRef(false);
  const blocked = useRef(false);
  const vertical = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {if (active) setReduceMotion(value);});
    const change = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {active = false; change.remove();};
  }, []);

  useEffect(() => {
    const listener = progress.addListener(({value}) => {position.current = value;});
    return () => {progress.stopAnimation(); progress.removeListener(listener);};
  }, [progress]);

  const settle = useCallback((open: boolean) => {
    Keyboard.dismiss();
    const changed = target.current !== open;
    target.current = open;
    if (changed) selectionHaptic();
    progress.stopAnimation();
    if (open) setRevealed(true);
    if (reduceMotion) {
      progress.setValue(open ? 1 : 0);
      setRevealed(open);
      return;
    }
    Animated.spring(progress, {
      toValue: open ? 1 : 0,
      stiffness: 260,
      damping: 32,
      mass: 1,
      overshootClamping: true,
      restDisplacementThreshold: 0.001,
      restSpeedThreshold: 0.001,
      useNativeDriver: Platform.OS !== 'web',
    }).start(({finished}) => {if (finished && !open && !target.current) setRevealed(false);});
  }, [progress, reduceMotion]);
  const close = useCallback(() => settle(false), [settle]);
  const open = useCallback(() => settle(true), [settle]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !active) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!target.current && position.current <= 0) return false;
      close();
      return true;
    });
    return () => back.remove();
  }, [active, close]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !active) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (target.current || position.current > 0)) {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [active, close]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: () => {
      blocked.current = false;
      vertical.current = false;
      return false;
    },
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      if (blocked.current || vertical.current || gesture.numberActiveTouches !== 1) return false;
      const x = Math.abs(gesture.dx);
      const y = Math.abs(gesture.dy);
      if (y > 10 && y > x) {vertical.current = true; return false;}
      if (x < 10 || x < y * 1.5) return false;
      return gesture.dx > 0 ? position.current < 1 : position.current > 0;
    },
    onPanResponderGrant: () => {
      progress.stopAnimation();
      origin.current = position.current;
      Keyboard.dismiss();
      setRevealed(true);
    },
    onPanResponderMove: (_, gesture) => {
      const next = drawerProgress(origin.current, gesture.dx, drawerWidth);
      position.current = next;
      progress.setValue(next);
    },
    onPanResponderRelease: (_, gesture) => {
      const next = drawerProgress(origin.current, gesture.dx, drawerWidth);
      settle(shouldOpenDrawer(next, gesture.vx));
    },
    onPanResponderTerminate: () => settle(target.current),
    onPanResponderTerminationRequest: () => false,
  }), [drawerWidth, progress, settle]);

  const radius = (value: number) => progress.interpolate({inputRange: [0, 0.2, 1], outputRange: [0, value, value / openScale], extrapolate: 'clamp'});
  return <DrawerGestureGuard.Provider value={blocked}>
    <View testID="chat-drawer" style={[styles.root, {backgroundColor: c.drawer}]} {...pan.panHandlers} onAccessibilityEscape={close}>
      <View
        style={[StyleSheet.absoluteFill, {width: drawerWidth, display: revealed ? 'flex' : 'none'}]}
        pointerEvents={revealed ? 'auto' : 'none'}
        aria-hidden={!revealed}
        accessibilityElementsHidden={!revealed}
        importantForAccessibility={revealed ? 'auto' : 'no-hide-descendants'}>
        <ChatHistory workspace={workspace} close={close} openSettings={openSettings}/>
      </View>
      <Animated.View testID="chat-panel" style={[styles.panel, {
        backgroundColor: c.background,
        boxShadow: !isDark && revealed ? '-6px 0px 22px rgba(0, 0, 0, 0.04)' : undefined,
        borderTopLeftRadius: radius(corners.topLeft),
        borderTopRightRadius: radius(corners.topRight),
        borderBottomLeftRadius: radius(corners.bottomLeft),
        borderBottomRightRadius: radius(corners.bottomRight),
        transform: [
          // Scaling around the center adds an inset; subtract it to align with the history width.
          {translateX: progress.interpolate({inputRange: [0, 1], outputRange: [0, drawerWidth - width * (1 - openScale) / 2]})},
          {scale: progress.interpolate({inputRange: [0, 1], outputRange: [1, openScale]})},
        ],
      }]}>
        <View style={styles.content} pointerEvents={revealed ? 'none' : 'auto'} aria-hidden={revealed} accessibilityElementsHidden={revealed} importantForAccessibility={revealed ? 'no-hide-descendants' : 'auto'}>
          {children(open)}
        </View>
        <Animated.View testID="chat-preview-scrim" pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, {backgroundColor: c.drawer, opacity: progress.interpolate({inputRange: [0, 1], outputRange: [0, previewScrimOpacity], extrapolate: 'clamp'})}]}/>
        {revealed && <Pressable testID="chat-drawer-close" accessibilityRole="button" accessibilityLabel="채팅으로 돌아가기" onPress={close} style={StyleSheet.absoluteFill}/>}
      </Animated.View>
    </View>
  </DrawerGestureGuard.Provider>;
}

const styles = StyleSheet.create({
  root: {flex: 1, overflow: 'hidden'},
  panel: {...StyleSheet.absoluteFillObject, overflow: 'hidden'},
  content: {flex: 1},
});
