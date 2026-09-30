import {Platform, Pressable, Text, View} from 'react-native';
import {Icon, type IconName} from './Icon';
import {colors, navigation as m} from './tokens';

export const tabs = ['library', 'chats', 'create', 'settings'] as const;
export type Tab = typeof tabs[number];
export const tabLabels: Record<Tab, string> = {library: '서재', chats: '채팅', create: '생성', settings: '설정'};
const headerActions: Record<Tab, {icon: IconName; label: string}> = {
  library: {icon: 'plus', label: '카드 가져오기'},
  chats: {icon: 'compose', label: '새 채팅'},
  create: {icon: 'plus', label: '새 카드 만들기'},
  settings: {icon: 'compose', label: '프로필 편집'},
};

export function Header({tab, scale: s, onSearch, searchOpen, onAction}: {tab: Tab; scale: number; onSearch: () => void; searchOpen: boolean; onAction?: () => void}) {
  const action = headerActions[tab];
  const touch = Math.max(48, m.actionSize * s);
  return <View testID="ui-header" style={{height: m.headerHeight * s, flexShrink: 0, paddingLeft: m.titleInset * s,
    paddingRight: m.actionInset * s, flexDirection: 'row', alignItems: 'center'}}>
    <Text testID="ui-title" accessibilityRole="header" numberOfLines={1} style={{flex: 1, minWidth: 0, color: colors.foreground,
      ...(Platform.OS === 'android' ? {fontFamily: 'sans-serif'} : {}),
      fontSize: m.titleSize * s, lineHeight: m.titleLineHeight * s, fontWeight: '700', includeFontPadding: false,
      transform: [{translateY: m.titleOffsetY * s}]}}>{tabLabels[tab]}</Text>
    {tab !== 'settings' && <Pressable testID={`ui-${tab}-search-button`} accessibilityRole="button" accessibilityLabel={`${tabLabels[tab]} 검색`}
      accessibilityState={{expanded: searchOpen}} aria-expanded={searchOpen} onPress={onSearch}
      style={({pressed}) => ({width: touch, height: touch, flexShrink: 0, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.55 : 1})}>
      <Icon name="search" size={m.iconSize * s}/>
    </Pressable>}
    <Pressable testID="ui-header-action" accessibilityRole="button" accessibilityLabel={action.label} accessibilityState={{disabled: !onAction}} disabled={!onAction}
      onPress={onAction} style={({pressed}) => ({width: touch, height: touch, flexShrink: 0, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.55 : 1})}>
      <Icon name={action.icon} size={m.iconSize * s}/>
    </Pressable>
  </View>;
}

export function TabBar({tab, onChange, scale: s, bottomInset}: {tab: Tab; onChange: (tab: Tab) => void; scale: number; bottomInset: number}) {
  const height = Math.max(48, m.tabHeight * s);
  return <View testID="ui-tab-bar" accessibilityRole="tablist" style={{height: height + bottomInset, flexShrink: 0, paddingBottom: bottomInset, backgroundColor: colors.background}}>
    <View pointerEvents="none" style={{position: 'absolute', top: 0, left: 0, right: 0, height: m.separatorHeight * s, backgroundColor: colors.separator}}/>
    <View style={{flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row'}}>
      {tabs.map(item => <Pressable key={item} testID={`ui-tab-${item}`} accessibilityRole="tab" accessibilityLabel={tabLabels[item]}
        accessibilityState={{selected: item === tab}} aria-selected={item === tab} onPress={() => onChange(item)}
        style={({pressed}) => ({flex: 1, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.55 : 1})}>
        <TabIcon tab={item} selected={item === tab} scale={s}/>
      </Pressable>)}
    </View>
  </View>;
}

function TabIcon({tab, selected, scale: s}: {tab: Tab; selected: boolean; scale: number}) {
  if (tab !== 'settings') {
    const name = tab === 'library' ? (selected ? 'librarySelected' : 'library') : tab === 'chats' ? (selected ? 'chatsSelected' : 'chats') : (selected ? 'plusSelected' : 'plus');
    return <Icon name={name} size={m.iconSize * s}/>;
  }
  const avatar = m.avatarSize * s;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none"
    style={{width: m.avatarRingSize * s, height: m.avatarRingSize * s, borderRadius: m.avatarRingSize * s / 2, borderWidth: 2.5 * s,
      borderColor: selected ? colors.foreground : 'transparent', alignItems: 'center', justifyContent: 'center'}}>
    <View style={{width: avatar, height: avatar, borderRadius: avatar / 2, backgroundColor: colors.avatarBackground, overflow: 'hidden', alignItems: 'center'}}>
      <View style={{position: 'absolute', top: avatar * 9 / 44, width: avatar * 18 / 44, height: avatar * 18 / 44, borderRadius: avatar, backgroundColor: colors.avatarForeground}}/>
      <View style={{position: 'absolute', top: avatar * 30 / 44, width: avatar * 40 / 44, height: avatar * 34 / 44, borderRadius: avatar / 2, backgroundColor: colors.avatarForeground}}/>
      <View style={{position: 'absolute', inset: 0, borderRadius: avatar / 2, borderWidth: s, borderColor: colors.avatarBorder}}/>
    </View>
  </View>;
}
