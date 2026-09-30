import {Platform, Pressable, Text, View, type StyleProp, type ViewStyle} from 'react-native';
import {Icon, type IconName} from './Icon';
import {TabIcon} from './TabIcon';
import {colors, navigation as m, navigationActionMetrics} from './tokens';
import {tabs, tabLabels, type Tab} from './navigationRoutes';
export {tabs, tabLabels, type Tab} from './navigationRoutes';
const headerActions: Record<Tab, {icon: IconName; label: string}> = {
  library: {icon: 'plus', label: '카드 가져오기'},
  chats: {icon: 'compose', label: '새 채팅'},
  create: {icon: 'plus', label: '새 카드 만들기'},
  settings: {icon: 'compose', label: '프로필 편집'},
};

export function NavigationButton({icon, label, scale, onPress, expanded, testID, style}: {
  icon: IconName; label: string; scale: number; onPress?: (() => void) | undefined; expanded?: boolean;
  testID?: string; style?: StyleProp<ViewStyle>;
}) {
  const {size, iconSize} = navigationActionMetrics(scale);
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{disabled: !onPress, ...(expanded === undefined ? {} : {expanded})}} aria-expanded={expanded}
    disabled={!onPress} onPress={onPress}
    style={({pressed}) => [{width: size, height: size, flexShrink: 0, alignItems: 'center', justifyContent: 'center'},
      style, {opacity: pressed ? 0.55 : 1}]}>
    <Icon name={icon} size={iconSize}/>
  </Pressable>;
}

export function Header({tab, scale: s, onSearch, searchOpen, onAction}: {tab: Tab; scale: number; onSearch: () => void; searchOpen: boolean; onAction?: () => void}) {
  const action = headerActions[tab];
  return <View testID="ui-header" style={{height: m.headerHeight * s, flexShrink: 0, paddingLeft: m.titleInset * s,
    paddingRight: m.actionInset * s, flexDirection: 'row', alignItems: 'center'}}>
    <Text testID="ui-title" accessibilityRole="header" numberOfLines={1} style={{flex: 1, minWidth: 0, color: colors.foreground,
      ...(Platform.OS === 'android' ? {fontFamily: 'sans-serif'} : {}),
      fontSize: m.titleSize * s, lineHeight: m.titleLineHeight * s, fontWeight: '700', includeFontPadding: false,
      transform: [{translateY: m.titleOffsetY * s}]}}>{tabLabels[tab]}</Text>
    {tab !== 'settings' && <NavigationButton testID={`ui-${tab}-search-button`} icon="search" label={`${tabLabels[tab]} 검색`}
      scale={s} onPress={onSearch} expanded={searchOpen}/>}
    <NavigationButton testID="ui-header-action" icon={action.icon} label={action.label} scale={s} onPress={onAction}/>
  </View>;
}

export function TabBar({tab, onChange, scale: s, bottomInset}: {tab: Tab; onChange: (tab: Tab) => void; scale: number; bottomInset: number}) {
  const height = Math.max(48, m.tabHeight * s);
  return <View testID="ui-tab-bar" accessibilityRole="tablist" style={{height: height + bottomInset, flexShrink: 0, paddingBottom: bottomInset, backgroundColor: colors.background}}>
    <View pointerEvents="none" style={{position: 'absolute', top: 0, left: 0, right: 0, height: m.separatorHeight * s, backgroundColor: colors.separator}}/>
    <View style={{flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row'}}>
      {tabs.map(item => <Pressable key={item} testID={`ui-tab-${item}`} accessibilityRole="tab" accessibilityLabel={tabLabels[item]}
        accessibilityState={{selected: item === tab}} aria-selected={item === tab}
        {...(Platform.OS === 'web' ? {delayPressIn: 0} : {unstable_pressDelay: 0})}
        onPressIn={() => onChange(item)} onPress={() => onChange(item)}
        style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <TabIcon name={item} selected={item === tab} size={m.iconSize * s}/>
      </Pressable>)}
    </View>
  </View>;
}
