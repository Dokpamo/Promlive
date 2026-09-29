import type {ReactNode} from 'react';
import {Text, View} from 'react-native';
import {useDesign} from '../design/foundation';
import {NavigationIcon, type NavigationIconName} from '../design/NavigationIcon';
import {navigationMetrics as m} from '../design/navigationMetrics';
import {PressSurface} from '../layout/PressSurface';

/** The four root tabs share a compact, left-aligned title and plain actions. */
export function MainTabHeader({title, left, right, testID, titleTestID}: {
  title: string; left?: ReactNode; right?: ReactNode; testID?: string; titleTestID?: string;
}) {
  const {s, color} = useDesign();
  return <View testID={testID} style={{height: m.headerHeight * s, flexShrink: 0, paddingLeft: (left ? m.actionInset : m.titleInset) * s,
    paddingRight: m.actionInset * s, flexDirection: 'row', alignItems: 'center', backgroundColor: color.background}}>
    {left}
    <Text testID={titleTestID} accessibilityRole="header" numberOfLines={1} style={{flex: 1, minWidth: 0, marginLeft: left ? 14 * s : 0,
      color: color.text, fontSize: m.titleSize * s, lineHeight: m.titleLineHeight * s, fontWeight: '700', includeFontPadding: false}}>{title}</Text>
    {right && <View style={{flexDirection: 'row', alignItems: 'center', gap: 8 * s}}>{right}</View>}
  </View>;
}

export function MainHeaderButton({icon, label, onPress, disabled = false, testID}: {
  icon: NavigationIconName; label: string; onPress: () => void; disabled?: boolean; testID?: string;
}) {
  const {s, color} = useDesign();
  const touchSize = Math.max(48, m.actionSize * s);
  return <PressSurface testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled}
    onPress={onPress} compact radius={touchSize / 2} highlightColor={color.surface}
    style={{width: touchSize, height: touchSize, flexShrink: 0}} contentStyle={{alignItems: 'center', justifyContent: 'center'}}>
    <NavigationIcon name={icon} size={m.iconSize * s} color={color.text}/>
  </PressSurface>;
}
