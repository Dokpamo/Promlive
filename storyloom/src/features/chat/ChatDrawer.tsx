import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {AccessibilityInfo, Animated, BackHandler, PanResponder, Platform, Pressable, StyleSheet, View, useWindowDimensions} from 'react-native';
import type {Workspace} from '../../app/workspace';
import type {Card} from '../cards/model';
import {ChatHistory} from './ChatHistory';
import {useAppearance} from '../appearance/AppAppearance';
import {drawerProgress, navigationPanel, shouldOpenDrawer, type NavigationPanel} from './drawerMotion';
import {useScreenCorners} from './useScreenCorners';
import {DrawerGestureGuard} from './DrawerGestureBoundary';
import {sidebarWidth} from './chatAppearance';
import {usePanelMotion} from './usePanelMotion';

const openScale = 0.90;
const previewScrimOpacity = 0.61;

export function ChatDrawer({workspace, children, openSettings, active = true, pocketEnabled = true}: {
  workspace: Workspace;
  children: (open: () => void) => ReactNode;
  openSettings: () => void;
  active?: boolean;
  /** The creator can opt a card out when card authoring is connected. */
  pocketEnabled?: boolean;
}) {
  const {colors: c, isDark} = useAppearance();
  const {width} = useWindowDimensions();
  const drawerWidth = sidebarWidth(width);
  const corners = useScreenCorners();
  const [reduceMotion, setReduceMotion] = useState(false);
  const cards = usePanelMotion(reduceMotion);
  const history = usePanelMotion(reduceMotion);
  const pocket = usePanelMotion(reduceMotion);
  const panels = useRef({cards, history, pocket});
  panels.current = {cards, history, pocket};
  const [historyCardId, setHistoryCardId] = useState<string | null>(null);
  const historyCard = workspace.cards.find(card => card.id === historyCardId);
  const activeCard = workspace.cards.find(card => card.id === workspace.conversation?.cardId);
  const blocked = useRef(false);
  const vertical = useRef(false);
  const multiTouch = useRef(false);
  const gesturePanel = useRef<NavigationPanel | null>(null);
  const origin = useRef(0);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {if (mounted) setReduceMotion(value);});
    const change = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {mounted = false; change.remove();};
  }, []);
  useEffect(() => {
    if (!cards.visible) {history.reset(); setHistoryCardId(null);}
  }, [cards.visible, history.reset]);
  useEffect(() => {if (!pocketEnabled) pocket.reset();}, [pocketEnabled, pocket.reset]);

  const closeCards = useCallback(() => cards.settle(false), [cards.settle]);
  const openCards = useCallback(() => {pocket.reset(); cards.settle(true);}, [cards.settle, pocket.reset]);
  const backToCards = useCallback(() => history.settle(false), [history.settle]);
  const openCard = (card: Card) => {setHistoryCardId(card.id); history.settle(true);};
  const back = useCallback(() => {
    const p = panels.current;
    if (p.history.visible) {p.history.settle(false); return true;}
    if (p.cards.visible) {p.cards.settle(false); return true;}
    if (p.pocket.visible) {p.pocket.settle(false); return true;}
    return false;
  }, []);

  useEffect(() => {
    if (!active) return;
    if (Platform.OS === 'android') {
      const listener = BackHandler.addEventListener('hardwareBackPress', back);
      return () => listener.remove();
    }
    if (Platform.OS === 'web') {
      const escape = (event: KeyboardEvent) => {if (event.key === 'Escape' && back()) event.preventDefault();};
      document.addEventListener('keydown', escape);
      return () => document.removeEventListener('keydown', escape);
    }
    return undefined;
  }, [active, back]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: (_, gesture) => {
      blocked.current = false;
      vertical.current = false;
      gesturePanel.current = null;
      multiTouch.current = gesture.numberActiveTouches > 1;
      return false;
    },
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      if (!active || blocked.current || vertical.current || gesture.numberActiveTouches !== 1) return false;
      const x = Math.abs(gesture.dx), y = Math.abs(gesture.dy);
      if (y > 10 && y > x) {vertical.current = true; return false;}
      if (x < 10 || x < y * 1.5) return false;
      const p = panels.current;
      gesturePanel.current = navigationPanel({cards: p.cards.position.current, history: p.history.position.current, pocket: p.pocket.position.current, pocketEnabled}, gesture.dx);
      return gesturePanel.current !== null;
    },
    onPanResponderGrant: () => {
      if (gesturePanel.current) origin.current = panels.current[gesturePanel.current].begin();
    },
    onPanResponderStart: (_, gesture) => {if (gesture.numberActiveTouches > 1) multiTouch.current = true;},
    onPanResponderMove: (_, gesture) => {
      if (gesture.numberActiveTouches > 1) multiTouch.current = true;
      const key = gesturePanel.current;
      if (!key || multiTouch.current) return;
      const direction = key === 'pocket' ? -1 : 1;
      panels.current[key].move(drawerProgress(origin.current, gesture.dx * direction, key === 'pocket' ? width : drawerWidth));
    },
    onPanResponderRelease: (_, gesture) => {
      const key = gesturePanel.current;
      if (!key) return;
      const panel = panels.current[key];
      const direction = key === 'pocket' ? -1 : 1;
      const next = drawerProgress(origin.current, gesture.dx * direction, key === 'pocket' ? width : drawerWidth);
      panel.settle(multiTouch.current ? panel.target.current : shouldOpenDrawer(next, gesture.vx * direction));
      gesturePanel.current = null;
    },
    onPanResponderTerminate: () => {
      const key = gesturePanel.current;
      if (key) panels.current[key].settle(panels.current[key].target.current);
      gesturePanel.current = null;
    },
    onPanResponderTerminationRequest: () => false,
  }), [active, drawerWidth, pocketEnabled, width]);

  const drawerRadius = (value: number) => cards.progress.interpolate({inputRange: [0, 0.2, 1], outputRange: [0, value, value / openScale], extrapolate: 'clamp'});
  const pageRadius = (value: number) => pocket.progress.interpolate({inputRange: [0, 0.15, 0.85, 1], outputRange: [0, value, value, 0], extrapolate: 'clamp'});
  const sidebarProps = {workspace, width: drawerWidth, openCard, backToCards, close: closeCards, openSettings};
  return <DrawerGestureGuard.Provider value={blocked}>
    <View testID="chat-drawer" style={[styles.root, {backgroundColor: c.drawer}]} {...pan.panHandlers} onAccessibilityEscape={back}>
      <View style={[StyleSheet.absoluteFill, {width: drawerWidth, display: cards.visible ? 'flex' : 'none', overflow: 'hidden'}]} pointerEvents={cards.visible ? 'auto' : 'none'} aria-hidden={!cards.visible} accessibilityElementsHidden={!cards.visible} importantForAccessibility={cards.visible ? 'auto' : 'no-hide-descendants'}>
        <View style={styles.content} pointerEvents={history.visible ? 'none' : 'auto'} aria-hidden={history.visible} accessibilityElementsHidden={history.visible} importantForAccessibility={history.visible ? 'no-hide-descendants' : 'auto'}><ChatHistory {...sidebarProps} selectedCardId={history.visible ? historyCardId ?? undefined : undefined}/></View>
        {historyCard && history.visible && <Animated.View testID="card-history-panel" style={[StyleSheet.absoluteFill, {backgroundColor: c.drawer, transform: [{translateX: history.progress.interpolate({inputRange: [0, 1], outputRange: [-drawerWidth, 0]})}]}]}><ChatHistory key={historyCard.id} {...sidebarProps} card={historyCard}/></Animated.View>}
      </View>

      <Animated.View testID="chat-panel" style={[styles.panel, {
        backgroundColor: c.drawer,
        boxShadow: !isDark && cards.visible ? '-6px 0px 22px rgba(0, 0, 0, 0.04)' : undefined,
        borderTopLeftRadius: drawerRadius(corners.topLeft), borderTopRightRadius: drawerRadius(corners.topRight),
        borderBottomLeftRadius: drawerRadius(corners.bottomLeft), borderBottomRightRadius: drawerRadius(corners.bottomRight),
        transform: [
          {translateX: cards.progress.interpolate({inputRange: [0, 1], outputRange: [0, drawerWidth - width * (1 - openScale) / 2]})},
          {scale: cards.progress.interpolate({inputRange: [0, 1], outputRange: [1, openScale]})},
        ],
      }]}>
        <View style={styles.content} pointerEvents={cards.visible ? 'none' : 'auto'} aria-hidden={cards.visible} accessibilityElementsHidden={cards.visible} importantForAccessibility={cards.visible ? 'no-hide-descendants' : 'auto'}>
          <Animated.View testID="chat-pocket-pages" style={[styles.pages, {width: pocketEnabled ? width * 2 : width, backgroundColor: c.background,
            borderTopLeftRadius: pageRadius(corners.topLeft), borderTopRightRadius: pageRadius(corners.topRight), borderBottomLeftRadius: pageRadius(corners.bottomLeft), borderBottomRightRadius: pageRadius(corners.bottomRight),
            transform: [{translateX: Animated.multiply(pocket.progress, -width)}],
          }]}>
            {/* One continuous surface: only its four outside corners are rounded. */}
            <View testID="chat-page" pointerEvents={pocket.visible ? 'none' : 'auto'} aria-hidden={pocket.visible} accessibilityElementsHidden={pocket.visible} importantForAccessibility={pocket.visible ? 'no-hide-descendants' : 'auto'} style={[styles.page, {left: 0, width}]}>{children(openCards)}</View>
            {pocketEnabled && pocket.visible && <View testID="pocket-page" accessible accessibilityLabel={`${activeCard?.title ?? '현재 카드'} 포켓`} accessibilityHint="오른쪽으로 밀면 채팅으로 돌아갑니다." onAccessibilityEscape={() => pocket.settle(false)} style={[styles.page, {left: width, width}]}/>}
          </Animated.View>
        </View>
        <Animated.View testID="chat-preview-scrim" pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, {backgroundColor: c.drawer, opacity: cards.progress.interpolate({inputRange: [0, 1], outputRange: [0, previewScrimOpacity], extrapolate: 'clamp'})}]}/>
        {cards.visible && <Pressable testID="chat-drawer-close" accessibilityRole="button" accessibilityLabel="채팅으로 돌아가기" onPress={closeCards} style={StyleSheet.absoluteFill}/>}
      </Animated.View>
    </View>
  </DrawerGestureGuard.Provider>;
}

const styles = StyleSheet.create({
  root: {flex: 1, overflow: 'hidden'},
  panel: {...StyleSheet.absoluteFillObject, overflow: 'hidden'},
  pages: {position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden'},
  page: {position: 'absolute', top: 0, bottom: 0, overflow: 'hidden'},
  content: {flex: 1},
});
