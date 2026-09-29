import type {ReactNode, Ref} from 'react';
import {Text, TextInput, View, useWindowDimensions, type PressableProps} from 'react-native';
import {useAppearance} from '../features/appearance/AppAppearance';
import {ChatIcon, type ChatIconName} from '../features/chat/ChatIcon';
import {PressSurface} from '../layout/PressSurface';
import {RowPressable} from '../layout/RowPressable';
import {headerScale} from '../layout/metrics';

/** Threads reference: strong left titles, neutral controls and fine separators. */
export const ui = {inset: 28, header: 96, search: 76, searchRadius: 28, touch: 66, icon: 36, tabBar: 82, row: 148, avatar: 64} as const;
export function useDesign() {
  const {width} = useWindowDimensions();
  const {isDark, colors: c} = useAppearance();
  return {s: headerScale(width), width, isDark, color: {background: c.background, surface: c.search, text: c.text, muted: c.muted, line: c.divider, accent: c.send, onAccent: c.sendIcon}};
}

export function IconButton({icon, label, onPress, testID, disabled = false}: {icon: ChatIconName; label: string; onPress: () => void; testID?: string; disabled?: boolean}) {
  const {s, color} = useDesign();
  return <PressSurface testID={testID} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    compact radius={12 * s} highlightColor={color.surface} style={{width: ui.touch * s, height: ui.touch * s, flexShrink: 0}} contentStyle={{alignItems: 'center', justifyContent: 'center'}}>
    <ChatIcon name={icon} size={ui.icon * s} color={color.text}/>
  </PressSurface>;
}

export function TopBar({title, left, right, align = 'left', large = false, testID, titleTestID}: {title: string; left?: ReactNode; right?: ReactNode; align?: 'left' | 'center'; large?: boolean; testID?: string; titleTestID?: string}) {
  const {s, color} = useDesign();
  return <View testID={testID} style={{height: ui.header * s, backgroundColor: color.background, paddingHorizontal: 17 * s, flexDirection: 'row', alignItems: 'center'}}>
    {align === 'center' ? <>
      <View style={{width: ui.touch * s, zIndex: 1}}>{left}</View>
      <Text testID={titleTestID} accessibilityRole="header" numberOfLines={1} style={{flex: 1, textAlign: 'center', color: color.text, fontSize: 36 * s, lineHeight: 46 * s, fontWeight: '700', includeFontPadding: false}}>{title}</Text>
      <View style={{minWidth: ui.touch * s, flexDirection: 'row', justifyContent: 'flex-end'}}>{right}</View>
    </> : <>
      {left}
      <Text testID={titleTestID} accessibilityRole="header" numberOfLines={1} style={{flex: 1, marginLeft: (left ? 22 : 11) * s, color: color.text, fontSize: (large ? 52 : 32) * s, lineHeight: (large ? 66 : 44) * s, fontWeight: large ? '800' : '700', includeFontPadding: false}}>{title}</Text>
      {right}
    </>}
  </View>;
}

export function SearchField({value, onChange, label = '검색', testID, inputRef, onFocus, onBlur, autoFocus = false}: {
  value: string; onChange: (value: string) => void; label?: string; testID?: string; inputRef?: Ref<TextInput>; onFocus?: () => void; onBlur?: () => void; autoFocus?: boolean;
}) {
  const {s, color} = useDesign();
  return <View style={{height: ui.search * s, borderRadius: ui.searchRadius * s, backgroundColor: color.surface, paddingHorizontal: 20 * s, flexDirection: 'row', alignItems: 'center', gap: 18 * s}}>
    <ChatIcon name="search" size={29 * s} color={color.muted}/>
    <TextInput ref={inputRef} testID={testID} accessibilityLabel={label} value={value} onChangeText={onChange} onFocus={onFocus} onBlur={onBlur} autoFocus={autoFocus}
      placeholder="검색" placeholderTextColor={color.muted} autoCapitalize="none" autoCorrect={false} returnKeyType="search" underlineColorAndroid="transparent" selectionColor={color.accent}
      style={{flex: 1, minWidth: 0, height: '100%', padding: 0, color: color.text, fontSize: 27 * s, includeFontPadding: false}}/>
    {!!value && <PressSurface accessibilityRole="button" accessibilityLabel="검색어 지우기" onPress={() => onChange('')} compact radius={12 * s} highlightColor={color.line}
      style={{width: 40 * s, height: 40 * s}} contentStyle={{alignItems: 'center', justifyContent: 'center'}}><ChatIcon name="close" size={20 * s} color={color.muted}/></PressSurface>}
  </View>;
}

export function ActionButton({label, onPress, primary = false, testID}: {label: string; onPress: () => void; primary?: boolean; testID?: string}) {
  const {s, color} = useDesign();
  return <PressSurface testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} radius={16 * s} highlightColor={color.line}
    style={{flex: 1, height: 60 * s, borderWidth: primary ? 0 : 1, borderColor: color.line, borderRadius: 16 * s}} contentStyle={{alignItems: 'center', justifyContent: 'center', backgroundColor: primary ? color.accent : color.background}}>
    <Text style={{color: primary ? color.onAccent : color.text, fontSize: 24 * s, fontWeight: '600', includeFontPadding: false}}>{label}</Text>
  </PressSurface>;
}

export function SubmitButton({label, accessibilityLabel = label, onPress, disabled = false, testID}: {label: string; accessibilityLabel?: string; onPress: () => void; disabled?: boolean; testID?: string}) {
  const {s, color} = useDesign();
  return <PressSurface testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    radius={40 * s} highlightColor={color.muted} style={{minWidth: 102 * s, height: 68 * s}} contentStyle={{paddingHorizontal: 28 * s, alignItems: 'center', justifyContent: 'center', backgroundColor: disabled ? color.line : color.accent}}>
    <Text style={{color: color.onAccent, fontSize: 25 * s, lineHeight: 34 * s, fontWeight: '600', includeFontPadding: false}}>{label}</Text>
  </PressSurface>;
}

type FilterPillProps = {label: string; selected: boolean; onPress: () => void; accessibilityLabel?: string} &
  Pick<PressableProps, 'onLongPress' | 'delayLongPress' | 'accessibilityHint' | 'accessibilityActions' | 'onAccessibilityAction'>;

export function FilterPill({label, selected, onPress, accessibilityLabel = label, ...pressProps}: FilterPillProps) {
  const {s, color} = useDesign();
  return <RowPressable {...pressProps} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{selected}} onPress={onPress} radius={36 * s}
    style={{borderRadius: 36 * s, borderWidth: 1, borderColor: color.line}}
    contentStyle={{height: 62 * s, minWidth: 100 * s, borderRadius: 36 * s, paddingHorizontal: 26 * s, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? color.surface : color.background}}>
    <Text numberOfLines={1} style={{color: color.text, fontSize: 25 * s, lineHeight: 34 * s, fontWeight: '600', includeFontPadding: false}}>{label}</Text>
  </RowPressable>;
}
