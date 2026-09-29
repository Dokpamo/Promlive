import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {Animated, Keyboard, PanResponder, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {PressSurface} from '../layout/PressSurface';
import {PagingLocks} from '../layout/PagingBoundary';
import {NavigationChrome, useNavigationChrome} from './NavigationChrome';
import {useDesign} from '../design/foundation';
import {NavigationIcon} from '../design/NavigationIcon';
import {navigationMetrics as m} from '../design/navigationMetrics';
import {UserAvatar} from '../features/profile/UserAvatar';
import {useUserProfile} from '../features/profile/UserProfileContext';

export const mainTabs = ['library', 'chats', 'create', 'settings'] as const;
export type MainTab = typeof mainTabs[number];
export const mainTabLabels: Record<MainTab, string> = {library: '서재', chats: '채팅', create: '생성', settings: '설정'};

/** Keep each collection's search, folder and scroll position while switching tabs. */
export function MainNavigation({tab, onChange, children, active = true}: {tab: MainTab; onChange: (tab: MainTab) => void; children: (tab: MainTab, active: boolean) => ReactNode; active?: boolean}) {
  const safe = useSafeAreaInsets();
  const {s, color, isDark} = useDesign();
  const [visited, setVisited] = useState<ReadonlySet<MainTab>>(() => new Set([tab]));
  const mountedTabs = new Set([...visited, tab]);
  const bottomInset = Math.max(48, m.tabHeight * s) + safe.bottom;
  const chrome = useNavigationChrome(tab, active, bottomInset);
  const locks = useRef(new Set<symbol>()).current;
  const touches = useRef(new Set<symbol>()).current;
  const setLock = useCallback((id: symbol, locked: boolean, touch = false) => {
    const set = touch ? touches : locks;
    if (locked) set.add(id); else set.delete(id);
  }, [locks, touches]);
  const current = useRef({tab, active}); current.current = {tab, active};
  // A horizontal drag on a static page cancels the pressed row without navigating.
  // Nested horizontal controls and editors retain their own gesture ownership.
  const cancelSwipePress = useMemo(() => {
    let vertical = false;
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {vertical = false; touches.clear(); return false;},
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        if (!current.current.active || !['chats', 'settings'].includes(current.current.tab) || locks.size || touches.size || gesture.numberActiveTouches !== 1) return false;
        if (Math.abs(gesture.dy) > 10 && Math.abs(gesture.dy) >= Math.abs(gesture.dx)) vertical = true;
        return !vertical && Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25;
      },
    });
  }, [locks, touches]);
  useEffect(() => {setVisited(current => new Set([...current, tab]));}, [tab]);
  const choose = (next: MainTab) => {
    Keyboard.dismiss();
    chrome.reset();
    onChange(next);
  };
  const tabBarVisible = !chrome.selecting;
  return <PagingLocks.Provider value={setLock}><NavigationChrome.Provider value={chrome}><View {...cancelSwipePress.panHandlers} testID="main-navigation" style={{flex: 1, overflow: 'hidden', backgroundColor: color.background}}>
    <View testID="main-tab-content" style={{flex: 1}}>
      {mainTabs.map(item => <View key={item} testID={`main-page-${item}`} pointerEvents={item === tab ? 'auto' : 'none'}
        aria-hidden={item !== tab} accessibilityElementsHidden={item !== tab} importantForAccessibility={item === tab ? 'auto' : 'no-hide-descendants'}
        style={{flex: 1, display: item === tab ? 'flex' : 'none'}}>
        {mountedTabs.has(item) && children(item, active && item === tab)}
      </View>)}
    </View>
    <Animated.View testID="main-tab-bar" accessibilityRole="tablist" pointerEvents={tabBarVisible ? 'auto' : 'none'} aria-hidden={!tabBarVisible}
      accessibilityElementsHidden={!tabBarVisible} importantForAccessibility={tabBarVisible ? 'auto' : 'no-hide-descendants'}
      style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: bottomInset, backgroundColor: color.background,
        paddingBottom: safe.bottom, paddingLeft: safe.left, paddingRight: safe.right,
        opacity: chrome.navigationProgress ?? 1,
        transform: [{translateY: chrome.navigationProgress?.interpolate({inputRange: [0, 1], outputRange: [bottomInset, 0]}) ?? 0}]}}>
      <View pointerEvents="none" style={{position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: isDark ? '#242424' : '#EDEDED'}}/>
      <View style={{width: '100%', maxWidth: 560, alignSelf: 'center', flex: 1, flexDirection: 'row', alignItems: 'center'}}>
        {mainTabs.map(item => {
          const selected = tab === item;
          return <PressSurface key={item} testID={`main-tab-${item}`} accessibilityRole="tab" accessibilityLabel={mainTabLabels[item]} accessibilityState={{selected}} aria-selected={selected}
            onPress={() => choose(item)} compact radius={0} highlightColor={color.surface} highlightOpacity={0} style={{flex: 1, height: '100%'}}
            contentStyle={{alignItems: 'center', justifyContent: 'center'}}>
            <View testID={`main-tab-icon-${item}`} pointerEvents="none" style={{width: m.avatarRingSize * s, height: m.avatarRingSize * s, alignItems: 'center', justifyContent: 'center'}}>
              <TabIcon tab={item} selected={selected}/>
            </View>
          </PressSurface>;
        })}
      </View>
    </Animated.View>
  </View></NavigationChrome.Provider></PagingLocks.Provider>;
}

function TabIcon({tab, selected}: {tab: MainTab; selected: boolean}) {
  const {color, s} = useDesign();
  if (tab === 'settings') return <ProfileTabIcon selected={selected}/>;
  const name = tab === 'library' ? (selected ? 'librarySelected' : 'library') : tab === 'chats' ? (selected ? 'chatsSelected' : 'chats') : (selected ? 'plusSelected' : 'plus');
  return <NavigationIcon name={name} size={m.iconSize * s} color={color.text}/>;
}

function ProfileTabIcon({selected}: {selected: boolean}) {
  const {color, s} = useDesign();
  const {value: profile} = useUserProfile();
  return <View accessible={false} style={{width: m.avatarRingSize * s, height: m.avatarRingSize * s, borderRadius: m.avatarRingSize * s / 2,
    borderWidth: 2.5 * s, borderColor: selected ? color.text : 'transparent', alignItems: 'center', justifyContent: 'center'}}>
    <UserAvatar image={profile.image} size={m.avatarSize * s}/>
  </View>;
}
