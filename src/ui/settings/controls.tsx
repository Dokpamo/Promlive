import {createContext, useContext, useState, type ReactNode} from 'react';
import {Platform, Pressable, ScrollView, Text, TextInput, View, type TextInputProps} from 'react-native';
import {NavigationButton} from '../Navigation';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {KeyboardPage} from '../KeyboardPage';
import {listTypography, navigation} from '../tokens';
import {usePalette} from '../Theme';
import {ToggleIndicator} from './ToggleIndicator';
export const SettingsFocusContext = createContext((_focused: boolean) => {});
export type Choice = {value: string; label: string; detail?: string};
export type SettingsNavigation = {back: () => void; push: (page: SettingsRender) => void; scale: number; bottomInset: number};
export type SettingsRender = (nav: SettingsNavigation) => ReactNode;

export function SettingsPage({title, nav, children, action, testID}: {title: string; nav: SettingsNavigation; children: ReactNode; action?: ReactNode; testID?: string}) {
  const colors = usePalette();
  const safe = useSafeAreaInsets();
  return <KeyboardPage testID={testID}
    keyboardVerticalOffset={safe.top}
    style={{flex: 1, minHeight: 0, backgroundColor: colors.background, paddingBottom: nav.bottomInset}}>
    <View testID="ui-settings-detail-header" style={{height: navigation.headerHeight * nav.scale, flexShrink: 0, flexDirection: 'row', alignItems: 'center', paddingLeft: navigation.backInset, paddingRight: navigation.actionInset * nav.scale}}>
      <NavigationButton testID="ui-settings-back" icon="back" label="뒤로" scale={nav.scale} onPress={nav.back}/>
      <Text accessibilityRole="header" numberOfLines={1} style={{flex: 1, minWidth: 0, marginLeft: 12, color: colors.foreground,
        fontSize: navigation.titleSize * nav.scale, lineHeight: navigation.titleLineHeight * nav.scale, fontWeight: '700', includeFontPadding: false,
        fontFamily: Platform.OS === 'android' ? 'sans-serif' : undefined, transform: [{translateY: navigation.titleOffsetY * nav.scale}]}}>{title}</Text>
      {action}
    </View>
    <ScrollView testID="ui-settings-detail-content" style={{flex: 1, minHeight: 0}} contentContainerStyle={{paddingTop: 12, paddingBottom: 32}}
      bounces showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {children}
    </ScrollView>
  </KeyboardPage>;
}
export function SettingRow({label, value = '', onPress, detail, testID, selected = false, disabled = false}: {
  label: string; value?: string; onPress?: () => void; detail?: string; testID?: string; selected?: boolean; disabled?: boolean;
}) {
  const colors = usePalette();
  const content = <><View style={{flex: 1, minWidth: 0, gap: 4}}><Text style={{...listTypography, color: colors.foreground}}>{label}</Text>
    {!!detail && <Text style={{fontSize: 14, lineHeight: 21, color: colors.secondaryForeground}}>{detail}</Text>}</View>
    {!!value && <Text numberOfLines={1} ellipsizeMode="tail" style={{...listTypography, maxWidth: '52%', flexShrink: 1, color: selected ? colors.foreground : colors.secondaryForeground}}>{value}</Text>}</>;
  const style = {minHeight: 56, paddingHorizontal: 18.67, paddingVertical: 14, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 16};
  return onPress ? <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={[label, value].filter(Boolean).join(', ')}
    accessibilityState={{selected, disabled}} disabled={disabled} onPress={onPress} style={({pressed}) => [style, {opacity: disabled ? .45 : pressed ? .55 : 1}]}>{content}</Pressable>
    : <View testID={testID} style={style}>{content}</View>;
}
export function SettingToggle({label, value, onChange, testID}: {label: string; value: boolean; onChange: (value: boolean) => void; testID?: string}) {
  const colors = usePalette();
  return <Pressable testID={testID} accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{checked: value}} aria-checked={value} onPress={() => onChange(!value)}
    style={{minHeight: 56, paddingHorizontal: 18.67, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 16}}>
    <Text style={{...listTypography, flex: 1, color: colors.foreground}}>{label}</Text>
    <ToggleIndicator value={value}/>
  </Pressable>;
}
export function TextAction({label, onPress, disabled = false, danger = false, testID}: {label: string; onPress: () => void; disabled?: boolean; danger?: boolean; testID?: string}) {
  const colors = usePalette();
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    style={({pressed}) => ({minWidth: 48, minHeight: 48, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center', opacity: disabled ? .4 : pressed ? .55 : 1})}>
    <Text style={{fontSize: 16, fontWeight: '600', color: danger ? colors.error : colors.foreground}}>{label}</Text>
  </Pressable>;
}
export function Section({children}: {children: ReactNode}) {
  const colors = usePalette();
  return <Text accessibilityRole="header" style={{fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.secondaryForeground, paddingHorizontal: 18.67, paddingTop: 26, paddingBottom: 8}}>{children}</Text>;
}
export function Note({children, error = false}: {children: ReactNode; error?: boolean}) {
  const colors = usePalette();
  return <Text {...(error ? {accessibilityRole: 'alert' as const} : {})} style={{fontSize: 14, lineHeight: 21, color: error ? colors.error : colors.secondaryForeground, paddingHorizontal: 18.67, paddingVertical: 10}}>{children}</Text>;
}
export function Field({label, value, onChange, secret = false, scale = 2 / 3, ...props}: Omit<TextInputProps, 'onChange'> & {
  label: string; value: string; onChange: (value: string) => void; secret?: boolean; scale?: number;
}) {
  const colors = usePalette(), setFocused = useContext(SettingsFocusContext);
  const [visible, setVisible] = useState(false);
  return <View style={{paddingHorizontal: 18.67, paddingTop: 14, paddingBottom: 10}}>
    <Text style={{...listTypography, marginBottom: 8, color: colors.secondaryForeground}}>{label}</Text>
    <View style={{flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: colors.surface, paddingLeft: 14, paddingRight: secret ? 0 : 14}}>
      <TextInput {...props} accessibilityLabel={label} value={value} onChangeText={onChange} secureTextEntry={secret && !visible}
        onFocus={event => {setFocused(true); props.onFocus?.(event);}} onBlur={event => {setFocused(false); props.onBlur?.(event);}}
        autoCapitalize={props.autoCapitalize ?? 'none'} autoCorrect={props.autoCorrect ?? false} placeholderTextColor={colors.secondaryForeground}
        underlineColorAndroid="transparent" textAlignVertical={props.multiline ? 'top' : 'center'}
        style={[{flex: 1, minWidth: 0, minHeight: props.multiline ? 130 : 48, paddingVertical: 12, paddingHorizontal: 0, fontSize: 16, lineHeight: 24, color: colors.foreground}, props.style]}/>
      {secret && <NavigationButton testID="ui-api-key-visibility" icon={visible ? 'eyeOff' : 'eye'} label={visible ? 'API 키 숨기기' : 'API 키 표시'} scale={scale} onPress={() => setVisible(value => !value)}/>}
    </View>
  </View>;
}
export function ChoicePage({nav, title, choices, value, onChoose, detail}: {nav: SettingsNavigation; title: string; choices: Choice[]; value: string; onChoose: (value: string) => void; detail?: string}) {
  return <SettingsPage title={title} nav={nav} testID="ui-settings-choice-page">
    {!!detail && <Note>{detail}</Note>}
    {choices.map(choice => <SettingRow key={choice.value} testID={`ui-choice-${choice.value}`} label={choice.label} {...(choice.detail ? {detail: choice.detail} : {})}
      value={value === choice.value ? '선택됨' : ''} selected={value === choice.value} onPress={() => {onChoose(choice.value); nav.back();}}/>)}
  </SettingsPage>;
}
export const choicesFrom = (labels: Record<string, string>): Choice[] => Object.entries(labels).map(([value, label]) => ({value, label}));
