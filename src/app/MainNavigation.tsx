import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {Animated, Keyboard, Platform, ScrollView, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAppearance} from '../features/appearance/AppAppearance';
import {ChatIcon} from '../features/chat/ChatIcon';
import {PressSurface} from '../layout/PressSurface';
import {useItemReducedMotion} from '../layout/itemListMotion';
import {PagingLocks} from '../layout/PagingBoundary';
import {NavigationChrome, useNavigationChrome} from './NavigationChrome';

export const mainTabs = ['library', 'chats', 'create', 'settings'] as const;
export type MainTab = typeof mainTabs[number];
export const mainTabLabels: Record<MainTab, string> = {library: '서재', chats: '채팅', create: '생성', settings: '설정'};

/** Keep each collection's search, folder and scroll position while switching tabs. */
export function MainNavigation({tab, onChange, children, active = true}: {tab: MainTab; onChange: (tab: MainTab) => void; children: (tab: MainTab, active: boolean) => ReactNode; active?: boolean}) {
  const {colors: c} = useAppearance();
  const safe = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const pager = useRef<ScrollView>(null);
  const offset = useRef(0);
  const reduced = useItemReducedMotion();
  const webEnd = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locks = useRef(new Set<symbol>()).current;
  const touchLocks = useRef(new Set<symbol>()).current;
  const enabled = useRef(active); enabled.current = active;
  const [pagingLocked, setPagingLocked] = useState(false);
  const [visited, setVisited] = useState<ReadonlySet<MainTab>>(() => new Set([tab]));
  const index = mainTabs.indexOf(tab);
  const mountedTabs = new Set([...visited, ...mainTabs.filter((_, i) => Math.abs(i - index) <= 1)]);
  const bottomInset = 64 + Math.max(safe.bottom, 6);
  const chrome = useNavigationChrome(tab, active, bottomInset);
  const syncLocks = useCallback(() => {
    const locked = locks.size + touchLocks.size > 0;
    // Apply immediately: waiting for a render lets the native parent steal the first MOVE.
    if (Platform.OS !== 'web') pager.current?.setNativeProps({scrollEnabled: enabled.current && !locked});
    setPagingLocked(locked);
  }, [locks, touchLocks]);
  const setLock = useCallback((id: symbol, locked: boolean, touch = false) => {
    const target = touch ? touchLocks : locks;
    if (locked) target.add(id); else target.delete(id);
    syncLocks();
  }, [locks, touchLocks, syncLocks]);
  const releaseTouchLocks = useCallback(() => {if (touchLocks.size) {touchLocks.clear(); syncLocks();}}, [touchLocks, syncLocks]);
  useEffect(() => {
    setVisited(current => new Set([...current, ...mainTabs.filter((_, i) => Math.abs(i - index) <= 1)]));
    const x = index * width;
    if (Math.abs(offset.current - x) > 1) pager.current?.scrollTo({x, animated: !reduced});
  }, [index, width, reduced]);
  useEffect(() => () => {if (webEnd.current) clearTimeout(webEnd.current);}, []);
  const choose = (next: MainTab) => {
    Keyboard.dismiss();
    chrome.reset();
    onChange(next);
  };
  const settlePage = (x: number) => {
    const next = mainTabs[Math.max(0, Math.min(mainTabs.length - 1, Math.round(x / width)))]!;
    if (next !== tab) choose(next);
  };
  const scrollPage = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.x;
    // Native paging reports momentum completion; browsers report only scroll events.
    if (Platform.OS === 'web') {
      if (webEnd.current) clearTimeout(webEnd.current);
      webEnd.current = setTimeout(() => settlePage(offset.current), 100);
    }
  };
  const tabBarVisible = chrome.visible && !chrome.selecting;
  return <PagingLocks.Provider value={setLock}><NavigationChrome.Provider value={chrome}><View testID="main-navigation" style={{flex: 1, overflow: 'hidden', backgroundColor: tab === 'settings' ? c.drawer : c.background}}
    onStartShouldSetResponderCapture={() => {releaseTouchLocks(); return false;}}
    onTouchEnd={event => {if (!event.nativeEvent.touches.length) releaseTouchLocks();}}>
    <ScrollView ref={pager} testID="main-tab-pager" horizontal pagingEnabled directionalLockEnabled bounces={false} overScrollMode="never" scrollEnabled={active && !pagingLocked}
      showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" onScrollBeginDrag={() => Keyboard.dismiss()} scrollEventThrottle={16}
      onScroll={scrollPage} onMomentumScrollEnd={event => settlePage(event.nativeEvent.contentOffset.x)} style={{flex: 1}} contentContainerStyle={{height: '100%'}}>
      {mainTabs.map(item => <View key={item} testID={`main-page-${item}`} pointerEvents={item === tab ? 'auto' : 'none'}
        aria-hidden={item !== tab} accessibilityElementsHidden={item !== tab} importantForAccessibility={item === tab ? 'auto' : 'no-hide-descendants'}
        style={{width, height: '100%'}}>
        {mountedTabs.has(item) && children(item, active && item === tab)}
      </View>)}
    </ScrollView>
    <Animated.View testID="main-tab-bar" accessibilityRole="tablist" pointerEvents={tabBarVisible ? 'auto' : 'none'} aria-hidden={!tabBarVisible}
      accessibilityElementsHidden={!tabBarVisible} importantForAccessibility={tabBarVisible ? 'auto' : 'no-hide-descendants'}
      style={{position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: c.background, paddingBottom: Math.max(safe.bottom, 6), paddingLeft: safe.left, paddingRight: safe.right,
        opacity: chrome.navigationProgress ?? 1,
        transform: [{translateY: Animated.add(chrome.progress.interpolate({inputRange: [0, 1], outputRange: [bottomInset, 0]}),
          chrome.navigationProgress?.interpolate({inputRange: [0, 1], outputRange: [bottomInset, 0]}) ?? 0)}]}}>
      <View style={{width: '100%', maxWidth: 560, alignSelf: 'center', height: 64, flexDirection: 'row', alignItems: 'center'}}>
        {mainTabs.map(item => {
          const selected = tab === item;
          return <PressSurface key={item} testID={`main-tab-${item}`} accessibilityRole="tab" accessibilityLabel={mainTabLabels[item]} accessibilityState={{selected}} aria-selected={selected}
            onPress={() => choose(item)} compact radius={18} highlightColor={c.historyPressed} style={{flex: 1, height: 54, marginHorizontal: width < 360 ? 3 : 6}}
            contentStyle={{alignItems: 'center', justifyContent: 'center'}}>
            <View style={{width: 60, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: item === 'create' ? c.button : 'transparent'}}>
              <NavigationIcon tab={item} selected={selected}/>
            </View>
          </PressSurface>;
        })}
      </View>
    </Animated.View>
  </View></NavigationChrome.Provider></PagingLocks.Provider>;
}

function NavigationIcon({tab, selected}: {tab: MainTab; selected: boolean}) {
  const {colors: c} = useAppearance();
  const color = selected ? c.text : c.placeholder;
  if (tab === 'library') return <View accessible={false} style={{width: 28, height: 28, flexDirection: 'row', gap: 3, alignItems: 'center'}}>
    {[7, 7, 8].map((bookWidth, index) => <View key={index} style={{width: bookWidth, height: 25, borderWidth: 2, borderColor: color, borderRadius: 2, backgroundColor: selected ? color : 'transparent', transform: [{rotate: index === 2 ? '-12deg' : '0deg'}]}}/>)}
  </View>;
  if (tab === 'chats') return <View accessible={false} style={{width: 28, height: 25, borderWidth: 2, borderColor: color, borderRadius: 10, borderBottomLeftRadius: 2, backgroundColor: selected ? color : 'transparent', alignItems: 'center', justifyContent: 'center'}}>
    <Text accessible={false} style={{color: selected ? c.background : color, fontSize: 19, lineHeight: 19, marginTop: -7, fontWeight: '600'}}>···</Text>
  </View>;
  return <ChatIcon name={tab === 'create' ? 'plus' : 'settings'} size={28} color={color}/>;
}
