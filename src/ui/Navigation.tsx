import {usePalette, useTheme} from './Theme';
import {Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle} from 'react-native';
import {Icon, type IconName} from './Icon';
import {TabButton} from './TabButton';
import {useReducedMotion} from './useReducedMotion';
import {navigation as m, navigationActionMetrics} from './tokens';
import {tabs, tabLabels, type Tab} from './navigationRoutes';
import type {TabBarLayout} from './tabBarLayout';
import {useDesktopPane} from './desktop/DesktopPane';
export {tabs, tabLabels, type Tab} from './navigationRoutes';
const headerActions: Record<Tab, {icon: IconName; label: string}> = {
  library: {icon: 'plus', label: '카드 가져오기'},
  chats: {icon: 'compose', label: '새 채팅'},
  create: {icon: 'plus', label: '새 카드 만들기'},
  settings: {icon: 'compose', label: '프로필 편집'},
};

export function NavigationButton({icon, label, scale, onPress, expanded, testID, style, color}: {
  icon: IconName; label: string; scale: number; onPress?: (() => void) | undefined; expanded?: boolean;
  testID?: string; style?: StyleProp<ViewStyle>; color?: string;
}) {
  const desktop = useDesktopPane(), {size: mobileSize, iconSize} = navigationActionMetrics(scale);
  const size = desktop ? 40 : mobileSize;
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{disabled: !onPress, ...(expanded === undefined ? {} : {expanded})}} aria-expanded={expanded}
    disabled={!onPress} onPress={onPress}
    style={[{width: size, height: size, flexShrink: 0, alignItems: 'center', justifyContent: 'center'}, style]}>
    <Icon name={icon} size={iconSize} color={color}/>
  </Pressable>;
}

export function Header({tab, scale: s, onSearch, searchOpen, onAction}: {tab: Tab; scale: number; onSearch: () => void; searchOpen: boolean; onAction?: () => void}) {
  const colors = usePalette();
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

export function TabBar({tab, onChange, scale: s, layout}: {tab: Tab; onChange: (tab: Tab) => void; scale: number; layout: TabBarLayout}) {
  const {appearance, colors} = useTheme();
  const reducedMotion = useReducedMotion();
  const buttons = tabs.map(item => <TabButton key={item} name={item} selected={item === tab} size={m.iconSize * s}
    reducedMotion={reducedMotion} onChange={onChange}/>);
  if (layout.floating) {
    const radius = layout.height / 2;
    return <View testID="ui-tab-bar-overlay" pointerEvents="box-none" style={{position: 'absolute', zIndex: 2, bottom: 0, left: 0, right: 0,
      height: layout.height + layout.bottom, paddingBottom: layout.bottom, alignItems: 'center'}}>
      <View testID="ui-tab-bar" accessibilityRole="tablist" style={{width: layout.width, height: layout.height, borderRadius: radius,
        shadowColor: '#000000', shadowOpacity: appearance === 'dark' ? 0.3 : 0.12, shadowRadius: 12, shadowOffset: {width: 0, height: 4}}}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, {borderRadius: radius, backgroundColor: colors.background, overflow: 'hidden'}]}>
          <View style={[StyleSheet.absoluteFill, {borderRadius: radius, borderWidth: StyleSheet.hairlineWidth,
            borderColor: appearance === 'dark' ? '#FFFFFF2E' : '#FFFFFFE6'}]}/>
        </View>
        <View style={{flex: 1, flexDirection: 'row', paddingHorizontal: 6}}>{buttons}</View>
      </View>
    </View>;
  }
  return <View testID="ui-tab-bar" accessibilityRole="tablist" style={{height: layout.height + layout.bottom, flexShrink: 0, paddingBottom: layout.bottom, backgroundColor: colors.background}}>
    <View pointerEvents="none" style={{position: 'absolute', top: 0, left: 0, right: 0, height: m.separatorHeight * s, backgroundColor: colors.separator}}/>
    <View style={{flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row'}}>
      {buttons}
    </View>
  </View>;
}
