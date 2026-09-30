import {Platform, ScrollView, Text, View} from 'react-native';
import {useRef} from 'react';
import type {ScreenMemory} from './ScreenMemory';
import {usePlainScrollMemory} from './usePlainScrollMemory';
import {Icon, type IconName} from './Icon';
import {colors, listTypography, navigation, settingsLayout as layout} from './tokens';

const items: {id: string; title: string; icon: IconName}[] = [
  {id: 'ai', title: 'AI', icon: 'aiSettings'},
  {id: 'personas', title: '페르소나', icon: 'personas'},
  {id: 'prompt', title: '프롬프트', icon: 'prompt'},
  {id: 'theme', title: '테마', icon: 'appearance'},
  {id: 'language', title: '언어', icon: 'language'},
  {id: 'plugins', title: '플러그인', icon: 'plugin'},
  {id: 'info', title: '정보', icon: 'info'},
];

/** Root settings preview. Detail screens will be built within the new UI. */
export function Settings({scale, memory}: {scale: number; memory: ScreenMemory}) {
  const scroll = useRef<ScrollView>(null);
  const scrolling = usePlainScrollMemory(memory, 'settings', scroll);
  const iconSize = navigation.iconSize * scale;
  const horizontalInset = navigation.titleInset * scale;
  const labelStyle = {
    ...listTypography,
    color: colors.foreground,
    fontFamily: Platform.OS === 'android' ? 'sans-serif' : undefined,
  };
  return <ScrollView ref={scroll} {...scrolling} testID="ui-settings-list" style={{flex: 1, backgroundColor: colors.background}}
    contentContainerStyle={{paddingBottom: layout.rowVerticalInset * scale}}
    bounces={false} alwaysBounceVertical={false} overScrollMode="never" showsVerticalScrollIndicator={false}>
    <View testID="ui-settings-user" accessible accessibilityLabel="사용자, 이름과 프로필 이미지"
      style={{minHeight: layout.userHeight * scale, flexDirection: 'row', alignItems: 'flex-start',
        paddingHorizontal: horizontalInset, paddingVertical: layout.userTopInset * scale,
        gap: layout.iconGap * scale, borderBottomWidth: navigation.separatorHeight * scale, borderBottomColor: colors.separator}}>
      <Icon name="user" size={iconSize}/>
      <View style={{flex: 1, minWidth: 0, paddingTop: Math.max(0, (iconSize - listTypography.lineHeight) / 2), gap: layout.userTextGap * scale}}>
        <Text style={labelStyle}>사용자</Text>
        <Text style={{...labelStyle, color: colors.secondaryForeground}}>이름과 프로필 이미지</Text>
      </View>
    </View>
    {items.map(item => <View key={item.id} testID={`ui-settings-row-${item.id}`} accessible accessibilityLabel={item.title}
      style={{minHeight: Math.max(48, layout.rowHeight * scale), flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: horizontalInset, paddingVertical: layout.rowVerticalInset * scale, gap: layout.iconGap * scale}}>
      <Icon name={item.icon} size={iconSize}/>
      <Text style={{...labelStyle, flex: 1, minWidth: 0}}>{item.title}</Text>
    </View>)}
  </ScrollView>;
}
