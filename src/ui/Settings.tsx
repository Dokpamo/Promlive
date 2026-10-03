import {Platform, ScrollView, Text} from 'react-native';
import {ListPressable} from './ListPressable';
import {useDesktopPane} from './desktop/DesktopPane';
import {desktopMetrics} from './desktop/desktopMetrics';
import {useRef} from 'react';
import type {SettingsDestination} from './settings/OtherSettings';
import {usePalette} from './Theme';
import type {ScreenMemory} from './ScreenMemory';
import {usePlainScrollMemory} from './usePlainScrollMemory';
import {Icon, type IconName} from './Icon';
import {listTypography, navigation, settingsLayout as layout, settingsListLayout} from './tokens';
import {useTabBarContentInset} from './tabBarLayout';

const items: {id: SettingsDestination; title: string; icon: IconName}[] = [
  {id: 'profile', title: '사용자', icon: 'user'},
  {id: 'ai', title: 'AI', icon: 'aiSettings'},
  {id: 'personas', title: '페르소나', icon: 'personas'},
  {id: 'prompt', title: '프롬프트', icon: 'prompt'},
  {id: 'theme', title: '테마', icon: 'appearance'},
  {id: 'language', title: '언어', icon: 'language'},
  {id: 'plugins', title: '플러그인', icon: 'plugin'},
  {id: 'info', title: '정보', icon: 'info'},
];

/** The first settings page keeps the app’s shared icon family. */
export function Settings({scale, memory, onOpen, selected, compact = false}: {scale: number; memory: ScreenMemory; onOpen: (page: SettingsDestination) => void; selected?: SettingsDestination | null; compact?: boolean}) {
  const colors = usePalette(), desktop = useDesktopPane();
  const scroll = useRef<ScrollView>(null);
  const scrolling = usePlainScrollMemory(memory, 'settings', scroll);
  const bottomInset = useTabBarContentInset();
  const iconSize = navigation.iconSize * scale;
  const horizontalInset = navigation.titleInset * scale;
  const labelStyle = {
    ...listTypography, ...(desktop ? desktopMetrics.body : {}),
    color: colors.foreground,
    fontFamily: Platform.OS === 'android' ? 'sans-serif' : undefined,
  };
  return <ScrollView ref={scroll} {...scrolling} testID="ui-settings-list" style={{flex: 1, backgroundColor: colors.background}}
    contentContainerStyle={{paddingTop: settingsListLayout.topInset, paddingBottom: layout.rowVerticalInset * scale + bottomInset}}
    contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
    bounces={false} alwaysBounceVertical={false} overScrollMode="never" showsVerticalScrollIndicator={false}>
    {items.map(item => <ListPressable key={item.id} testID={item.id === 'profile' ? 'ui-settings-user' : `ui-settings-row-${item.id}`} accessibilityRole="button" accessibilityLabel={item.title} accessibilityState={{selected: selected === item.id}} aria-current={selected === item.id ? 'page' : undefined} onPress={() => onOpen(item.id)}
      style={{minHeight: desktop ? desktopMetrics.rowHeight : settingsListLayout.rowHeight, flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: compact ? 14 : horizontalInset, paddingVertical: layout.rowVerticalInset * scale, gap: compact ? 14 : layout.iconGap * scale,
        ...(compact ? {marginHorizontal: 10, marginBottom: 4, borderRadius: 12, backgroundColor: selected === item.id ? colors.surface : 'transparent'} : {})}}>
      <Icon name={item.icon} size={desktop ? 22 : compact ? 26 : iconSize}/>
      <Text style={{...labelStyle, flex: 1, minWidth: 0}}>{item.title}</Text>
    </ListPressable>)}
  </ScrollView>;
}
