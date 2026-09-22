import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode} from 'react';
import {AccessibilityInfo, Animated, BackHandler, PanResponder, Platform, Pressable, StyleSheet, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {ConversationList} from './ConversationList';
import type {Conversation} from './model';
import type {Card} from '../cards/model';
import type {CardListActions} from '../cards/store';
import {ChatHistory} from './ChatHistory';
import {CardConversationPanel} from './CardConversationPanel';
import {useAppearance} from '../appearance/AppAppearance';
import {navigationPanel, type NavigationPanel} from './drawerMotion';
import {useScreenCorners} from '../../layout/useScreenCorners';
import {DrawerGestureGuard, DrawerModalLocks} from './DrawerGestureBoundary';
import {referenceSidebar as r, sidebarWidth} from './chatAppearance';
import {headerScale} from '../../layout/metrics';
import {usePanelMotion} from './usePanelMotion';
import {DragClickBoundary} from '../../layout/DragClickBoundary';
import type {SheetScrollState} from '../../layout/sheetMotion';
import {useHistoryPull} from './useHistoryPull';
import {panelGroupScale, panelReference} from '../../layout/panelGeometry';

const openScale = 0.90;
const previewScrimOpacity = 0.61;

export function ChatDrawer({cardItems, cardActions, historyList, startChat, openConversation, report, children, openSettings, active = true, pocketEnabled = true}: {
  cardItems: readonly Card[];
  cardActions: CardListActions;
  historyList: ConversationList;
  startChat: (card?: Card) => Promise<void>;
  openConversation: (conversation: Conversation) => Promise<void>;
  report: (error: unknown) => void;
  children: (open: () => void) => ReactNode;
  openSettings: () => void;
  active?: boolean;
  /** The creator can opt a card out when card authoring is connected. */
  pocketEnabled?: boolean;
}) {
  useSyncExternalStore(historyList.subscribe, historyList.snapshot);
  const {colors: c, isDark} = useAppearance();
  const {width} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerWidth = sidebarWidth(width);
  const sidebarScale = drawerWidth / r.width;
  const surfaceScale = headerScale(width);
  const historyWidth = r.searchWidth * sidebarScale;
  const historyScale = panelGroupScale(width, historyWidth, insets.left + insets.right);
  const historyRadius = panelReference.radius * historyScale;
  const historyPadding = panelReference.groupPadding * historyScale;
  const corners = useScreenCorners();
  const [reduceMotion, setReduceMotion] = useState(false);
  const cards = usePanelMotion(reduceMotion, drawerWidth);
  const history = useHistoryPull((r.searchLeft + r.searchWidth) * sidebarScale + 32, reduceMotion);
  const historyPullRef = useRef(history);
  historyPullRef.current = history;
  const pocket = usePanelMotion(reduceMotion, width);
  const panels = useRef({cards, history, pocket});
  panels.current = {cards, history, pocket};
  const [historyCardId, setHistoryCardId] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const historyCard = cardItems.find(card => card.id === historyCardId);
  const activeCard = cardItems.find(card => card.id === historyList.selected?.cardId);
  const blocked = useRef(false);
  const modalLocks = useRef(0);
  const cancelClick = useRef(false);
  const vertical = useRef(false);
  const multiTouch = useRef(false);
  const gesturePanel = useRef<NavigationPanel | null>(null);
  const capturedPanelDrag = useRef(0);
  const historyOwnsGesture = useRef(false);
  const historyListTouched = useRef(false);
  const historyScroll = useRef<SheetScrollState>({offset: 0, canScroll: false});
  const capturedHistoryDrag = useRef({x: 0, y: 0});

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {if (mounted) setReduceMotion(value);});
    const change = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {mounted = false; change.remove();};
  }, []);
  useEffect(() => {
    if (historyCardId && (!historyCard || historyCard.archived)) {
      history.reset(); setHistoryCardId(null); setHistorySearch('');
    }
  }, [historyCard, historyCardId, history.reset]);
  useEffect(() => {if (!pocketEnabled) pocket.reset();}, [pocketEnabled, pocket.reset]);

  const closeCards = useCallback(() => {if (!modalLocks.current) cards.settle(false);}, [cards.settle]);
  const openCards = useCallback(() => {if (!modalLocks.current) {pocket.reset(); cards.settle(true);}}, [cards.settle, pocket.reset]);
  const backToCards = useCallback(() => {if (!modalLocks.current) history.settle(false);}, [history.settle]);
  const openCard = (card: Card) => {
    if (card.id !== historyCardId) setHistorySearch('');
    setHistoryCardId(card.id); history.settle(true);
  };
  const back = useCallback(() => {
    if (modalLocks.current) return false;
    const p = panels.current;
    if (p.cards.visible && p.history.visible) {historyPullRef.current.settle(false); return true;}
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
      if (!active || modalLocks.current) return false;
      if (gesture.numberActiveTouches > 1) {multiTouch.current = true; return false;}
      blocked.current = false;
      cancelClick.current = false;
      vertical.current = false;
      gesturePanel.current = null;
      capturedPanelDrag.current = 0;
      historyOwnsGesture.current = panels.current.cards.visible && panels.current.history.visible;
      historyListTouched.current = false;
      capturedHistoryDrag.current = {x: 0, y: 0};
      multiTouch.current = false;
      return false;
    },
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      // Keep this gesture on the same layer even after it reaches its closed edge.
      if (!active || modalLocks.current || blocked.current || vertical.current || gesturePanel.current || gesture.numberActiveTouches !== 1) return false;
      const x = Math.abs(gesture.dx), y = Math.abs(gesture.dy);
      const p = panels.current;
      const nextPanel = navigationPanel({cards: p.cards.position.current, historyOnTop: historyOwnsGesture.current, pocket: p.pocket.position.current, pocketEnabled}, gesture.dx);
      // Choose the layer on touch-down, including the popup's closing animation.
      // A drag over the exposed chat also belongs to the popup; only a tap opens chat.
      if (nextPanel === 'history') {
        if (Math.hypot(x, y) <= 10) return false;
        cancelClick.current = true;
        if (historyListTouched.current && historyScroll.current.canScroll && y > x) {vertical.current = true; return false;}
        gesturePanel.current = 'history';
        capturedHistoryDrag.current = {x: gesture.dx, y: gesture.dy};
        return true;
      }
      if (y > 10 && y > x) {vertical.current = true; return false;}
      if (x < 10 || x < y * 1.5) return false;
      gesturePanel.current = nextPanel;
      capturedPanelDrag.current = gesture.dx;
      return gesturePanel.current !== null;
    },
    onPanResponderGrant: () => {
      if (modalLocks.current) return;
      if (gesturePanel.current) {
        cancelClick.current = true;
        if (gesturePanel.current === 'history') {
          historyPullRef.current.begin(capturedHistoryDrag.current.x, capturedHistoryDrag.current.y);
          historyPullRef.current.move(0, 0);
        } else {
          const isPocket = gesturePanel.current === 'pocket';
          panels.current[gesturePanel.current].begin(capturedPanelDrag.current * (isPocket ? -1 : 1) / (isPocket ? width : drawerWidth));
        }
      }
    },
    onPanResponderStart: (_, gesture) => {if (gesture.numberActiveTouches > 1) multiTouch.current = true;},
    onPanResponderMove: (_, gesture) => {
      if (modalLocks.current) return;
      if (gesture.numberActiveTouches > 1) multiTouch.current = true;
      const key = gesturePanel.current;
      if (!key || multiTouch.current) return;
      if (key === 'history') {historyPullRef.current.move(gesture.dx, gesture.dy); return;}
      const direction = key === 'pocket' ? -1 : 1;
      panels.current[key].move(gesture.dx * direction / (key === 'pocket' ? width : drawerWidth));
    },
    onPanResponderRelease: (_, gesture) => {
      if (modalLocks.current) {gesturePanel.current = null; return;}
      const key = gesturePanel.current;
      if (!key) return;
      if (key === 'history') {
        historyPullRef.current.release(gesture.dx, gesture.dy, gesture.vx, multiTouch.current);
        gesturePanel.current = null;
        return;
      }
      const panel = panels.current[key];
      const direction = key === 'pocket' ? -1 : 1;
      panel.release(gesture.dx * direction / (key === 'pocket' ? width : drawerWidth), gesture.vx * direction, multiTouch.current);
      gesturePanel.current = null;
    },
    onPanResponderTerminate: () => {
      const key = gesturePanel.current;
      if (key === 'history') historyPullRef.current.settle(panels.current.history.target.current);
      else if (key) panels.current[key].settle(panels.current[key].target.current);
      gesturePanel.current = null;
    },
    onPanResponderTerminationRequest: () => false,
  }), [active, drawerWidth, pocketEnabled, width]);

  const drawerRadius = (value: number) => cards.progress.interpolate({inputRange: [0, 0.2, 1], outputRange: [0, value, value / openScale], extrapolate: 'clamp'});
  const pageRadius = (value: number) => pocket.progress.interpolate({inputRange: [0, 0.15, 0.85, 1], outputRange: [0, value, value, 0], extrapolate: 'clamp'});
  const historyTop = insets.top + (r.searchTop + r.searchHeight + r.listGap) * sidebarScale - r.historyPadding * surfaceScale;
  const historyBottom = insets.bottom + (r.footerHeight + r.footerBottom + r.historyBottomGap) * sidebarScale;
  return <DrawerModalLocks.Provider value={modalLocks}><DrawerGestureGuard.Provider value={blocked}>
    <DragClickBoundary cancelClick={cancelClick}>
    <View testID="chat-drawer" style={[styles.root, {backgroundColor: c.drawer}]} {...pan.panHandlers} onAccessibilityEscape={back}>
      <View style={[StyleSheet.absoluteFill, {width: drawerWidth, display: cards.visible ? 'flex' : 'none'}]} pointerEvents={cards.visible ? 'auto' : 'none'} aria-hidden={!cards.visible} accessibilityElementsHidden={!cards.visible} importantForAccessibility={cards.visible ? 'auto' : 'no-hide-descendants'}>
        <ChatHistory cards={cardItems} cardActions={cardActions} active={active && cards.visible} selectedCardId={historyList.selected?.cardId} startChat={startChat} report={report} width={drawerWidth} historyCard={history.visible ? historyCard : undefined} historyProgress={history.progress} historySearch={historySearch} onHistorySearch={setHistorySearch} openCard={openCard} close={closeCards} openSettings={openSettings}/>
        {historyCard && history.visible && <>
          <Pressable testID="card-history-backdrop" accessibilityRole="button" accessibilityLabel="채팅 기록 바깥 눌러 닫기" onPress={backToCards} style={{position: 'absolute', top: historyTop, bottom: historyBottom, left: 0, right: 0}}/>
          <Animated.View testID="card-history-panel" onLayout={history.onLayout} style={{
            position: 'absolute',
            top: historyTop,
            bottom: historyBottom,
            left: r.searchLeft * sidebarScale,
            width: historyWidth,
            borderRadius: historyRadius,
            backgroundColor: c.drawer,
            boxShadow: isDark ? '8px 4px 28px rgba(0, 0, 0, 0.4)' : '8px 4px 28px rgba(0, 0, 0, 0.12)',
            transform: history.transform,
          }}>
            <View testID="card-conversations-popup" style={{flex: 1, borderRadius: historyRadius, overflow: 'hidden', paddingVertical: historyPadding}}>
              <CardConversationPanel key={historyCard.id} history={historyList} openConversation={openConversation} report={report} scale={historyScale} card={historyCard} search={historySearch} close={closeCards} onClose={backToCards} scroll={historyScroll} onListTouch={() => {historyListTouched.current = true;}}/>
              <Pressable testID="card-history-handle" accessibilityRole="button" accessibilityLabel="카드 목록으로 돌아가기" accessibilityHint="누르거나 왼쪽으로 밀면 채팅내역을 닫습니다." onPress={backToCards} style={{position: 'absolute', top: '50%', right: 0, width: (r.textInset - r.rowInset) * historyScale, height: 82 * historyScale, transform: [{translateY: -41 * historyScale}], alignItems: 'center', justifyContent: 'center'}}>
                <View pointerEvents="none" style={{width: 7 * historyScale, height: 82 * historyScale, borderRadius: 4 * historyScale, backgroundColor: c.divider}}/>
              </Pressable>
            </View>
          </Animated.View>
        </>}
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
            {/* Share the background and outside clip; control shadows cross the page join. */}
            <View testID="chat-page" pointerEvents={pocket.visible ? 'none' : 'auto'} aria-hidden={pocket.visible} accessibilityElementsHidden={pocket.visible} importantForAccessibility={pocket.visible ? 'no-hide-descendants' : 'auto'} style={[styles.page, {left: 0, width}]}>{children(openCards)}</View>
            {pocketEnabled && pocket.visible && <View testID="pocket-page" accessible accessibilityLabel={`${activeCard?.title ?? '현재 카드'} 포켓`} accessibilityHint="오른쪽으로 밀면 채팅으로 돌아갑니다." onAccessibilityEscape={() => pocket.settle(false)} style={[styles.page, {left: width, width}]}/>}
          </Animated.View>
        </View>
        <Animated.View testID="chat-preview-scrim" pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, {backgroundColor: c.drawer, opacity: cards.progress.interpolate({inputRange: [0, 1], outputRange: [0, previewScrimOpacity], extrapolate: 'clamp'})}]}/>
        {cards.visible && <Pressable testID="chat-drawer-close" accessibilityRole="button" accessibilityLabel="채팅으로 돌아가기" onPress={closeCards} style={StyleSheet.absoluteFill}/>}
      </Animated.View>
    </View>
    </DragClickBoundary>
  </DrawerGestureGuard.Provider></DrawerModalLocks.Provider>;
}

const styles = StyleSheet.create({
  root: {flex: 1, overflow: 'hidden'},
  panel: {...StyleSheet.absoluteFillObject, overflow: 'hidden'},
  pages: {position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden'},
  page: {position: 'absolute', top: 0, bottom: 0},
  content: {flex: 1},
});
