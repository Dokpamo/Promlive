import {createContext, useContext, useState, type ReactNode} from 'react';
import {Platform, Pressable, ScrollView, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle} from 'react-native';
import {NavigationButton} from '../Navigation';
import {Icon} from '../Icon';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {KeyboardPage} from '../KeyboardPage';
import {listTypography, navigation, settingsDetailLayout, settingsListLayout} from '../tokens';
import {usePalette} from '../Theme';
import {ToggleIndicator} from './ToggleIndicator';
import type {GestureBlockRef} from '../HorizontalGesture.types';
export const SettingsFocusContext = createContext((_focused: boolean) => {});
export type Choice = {value: string; label: string; detail?: string};
export type SettingsPageOptions = {swipeBack?: boolean};
export type SettingsNavigation = {
  back: () => void; push: (page: SettingsRender, options?: SettingsPageOptions) => void;
  scale: number; bottomInset: number; scrollBlocker?: GestureBlockRef;
  closing?: boolean; blockBack?: (blocked: boolean) => void;
};
export type SettingsRender = (nav: SettingsNavigation) => ReactNode;

export function SettingsHeader({title, nav, action, backDisabled = false}: {title: string; nav: SettingsNavigation; action?: ReactNode; backDisabled?: boolean}) {
  const colors = usePalette();
  return <View testID="ui-settings-detail-header" style={{height: navigation.headerHeight * nav.scale, flexShrink: 0, flexDirection: 'row', alignItems: 'center', paddingLeft: navigation.backInset, paddingRight: navigation.actionInset * nav.scale}}>
    <NavigationButton testID="ui-settings-back" icon="back" label="뒤로" scale={nav.scale} onPress={backDisabled ? undefined : nav.back}/>
    <Text accessibilityRole="header" numberOfLines={1} style={{flex: 1, minWidth: 0, marginLeft: 12, color: colors.foreground,
      fontSize: navigation.titleSize * nav.scale, lineHeight: navigation.titleLineHeight * nav.scale, fontWeight: '700', includeFontPadding: false,
      fontFamily: Platform.OS === 'android' ? 'sans-serif' : undefined, transform: [{translateY: navigation.titleOffsetY * nav.scale}]}}>{title}</Text>
    {action}
  </View>;
}

export function SettingsPage({title, nav, children, action, testID}: {title: string; nav: SettingsNavigation; children: ReactNode; action?: ReactNode; testID?: string}) {
  const colors = usePalette();
  const safe = useSafeAreaInsets();
  return <KeyboardPage testID={testID}
    keyboardVerticalOffset={safe.top}
    style={{flex: 1, minHeight: 0, backgroundColor: colors.background, paddingBottom: nav.bottomInset}}>
    <SettingsHeader title={title} nav={nav} action={action}/>
    <ScrollView testID="ui-settings-detail-content" style={{flex: 1, minHeight: 0}} contentContainerStyle={{paddingTop: settingsListLayout.topInset, paddingBottom: 32}}
      bounces showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {children}
    </ScrollView>
  </KeyboardPage>;
}
export function SettingRow({label, value = '', onPress, detail, testID, selected = false, disabled = false, dimDisabled = true, labelStyle}: {
  label: string; value?: string; onPress?: () => void; detail?: string; testID?: string; selected?: boolean; disabled?: boolean; dimDisabled?: boolean; labelStyle?: StyleProp<TextStyle>;
}) {
  const colors = usePalette();
  const content = <><View style={{flex: 1, minWidth: 0, gap: 4}}><Text style={[{...listTypography, color: colors.foreground}, labelStyle]}>{label}</Text>
    {!!detail && <Text style={{fontSize: 14, lineHeight: 21, color: colors.secondaryForeground}}>{detail}</Text>}</View>
    {selected ? <Icon name="check" size={settingsDetailLayout.selectionIconSize}/> : !!value && <Text numberOfLines={1} ellipsizeMode="tail" style={{...listTypography, maxWidth: '52%', flexShrink: 1, color: colors.secondaryForeground}}>{value}</Text>}</>;
  const style = {minHeight: settingsListLayout.rowHeight, paddingHorizontal: settingsDetailLayout.horizontalInset, paddingVertical: 14, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 16,
    backgroundColor: selected ? colors.surface : 'transparent'};
  return onPress ? <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={[label, value].filter(Boolean).join(', ')}
    accessibilityState={{selected, disabled}} disabled={disabled} onPress={onPress} style={({pressed}) => [style, {opacity: disabled && dimDisabled ? .45 : pressed && !disabled ? .55 : 1}]}>{content}</Pressable>
    : <View testID={testID} style={style}>{content}</View>;
}
export function SettingToggle({label, value, onChange, testID}: {label: string; value: boolean; onChange: (value: boolean) => void; testID?: string}) {
  const colors = usePalette();
  return <Pressable testID={testID} accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{checked: value}} aria-checked={value} onPress={() => onChange(!value)}
    style={{minHeight: settingsListLayout.rowHeight, paddingHorizontal: settingsDetailLayout.horizontalInset, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 16}}>
    <Text style={{...listTypography, flex: 1, color: colors.foreground}}>{label}</Text>
    <ToggleIndicator value={value}/>
  </Pressable>;
}
export function TextAction({label, onPress, disabled = false, danger = false, testID}: {label: string; onPress: () => void; disabled?: boolean; danger?: boolean; testID?: string}) {
  const colors = usePalette();
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    style={({pressed}) => ({minWidth: 48, minHeight: 48, paddingHorizontal: settingsDetailLayout.textActionInset, justifyContent: 'center', alignItems: 'center', opacity: disabled ? .4 : pressed ? .55 : 1})}>
    <Text style={{fontSize: 16, fontWeight: '600', color: danger ? colors.error : colors.foreground}}>{label}</Text>
  </Pressable>;
}
export function Section({children}: {children: ReactNode}) {
  const colors = usePalette();
  return <Text accessibilityRole="header" style={{fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.secondaryForeground, paddingHorizontal: settingsDetailLayout.horizontalInset, paddingTop: 26, paddingBottom: 8}}>{children}</Text>;
}
export function Note({children, error = false}: {children: ReactNode; error?: boolean}) {
  const colors = usePalette();
  return <Text {...(error ? {accessibilityRole: 'alert' as const} : {})} style={{fontSize: 14, lineHeight: 21, color: error ? colors.error : colors.secondaryForeground, paddingHorizontal: settingsDetailLayout.horizontalInset, paddingVertical: 10}}>{children}</Text>;
}
export function Field({label, value, onChange, search = false, secret = false, groupDigits = false, scale = 2 / 3, ...props}: Omit<TextInputProps, 'onChange'> & {
  label: string; value: string; onChange: (value: string) => void; search?: boolean; secret?: boolean; groupDigits?: boolean; scale?: number;
}) {
  const colors = usePalette(), setFocused = useContext(SettingsFocusContext);
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(value);
  const grouped = groupDigits && /^\d+$/.test(value.trim()) ? value.trim().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : value;
  return <View style={{paddingHorizontal: settingsDetailLayout.horizontalInset,
    paddingTop: search ? 0 : 14, paddingBottom: search ? settingsDetailLayout.searchListGap : 10}}>
    {!search && <Text style={{...listTypography, marginBottom: 8, color: colors.foreground}}>{label}</Text>}
    <View style={{flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: colors.surface,
      paddingLeft: settingsDetailLayout.inputInset, paddingRight: secret ? 0 : settingsDetailLayout.inputInset}}>
      <TextInput {...props} accessibilityLabel={label} value={groupDigits ? editing ? draft : grouped : value}
        onChangeText={next => {
          const raw = groupDigits ? next.replace(/,/g, '') : next;
          if (groupDigits) setDraft(raw);
          onChange(raw);
        }} secureTextEntry={secret && !visible}
        onFocus={event => {
          if (groupDigits) {setDraft(value.replace(/,/g, '')); setEditing(true);}
          setFocused(true); props.onFocus?.(event);
        }} onBlur={event => {setEditing(false); setFocused(false); props.onBlur?.(event);}}
        autoCapitalize={props.autoCapitalize ?? 'none'} autoCorrect={props.autoCorrect ?? false} placeholderTextColor={colors.secondaryForeground}
        underlineColorAndroid="transparent" textAlignVertical={props.multiline ? 'top' : 'center'}
        style={[{flex: 1, minWidth: 0, minHeight: props.multiline ? 130 : 48, paddingVertical: 12, paddingHorizontal: 0, fontSize: 16, lineHeight: 24, color: colors.foreground}, props.style]}/>
      {secret && <NavigationButton testID="ui-api-key-visibility" icon={visible ? 'eyeOff' : 'eye'} label={visible ? 'API 키 숨기기' : 'API 키 표시'} scale={scale} onPress={() => setVisible(value => !value)}/>}
    </View>
  </View>;
}
export function ChoicePage({nav, title, choices, value, onChoose, labelStyle}: {nav: SettingsNavigation; title: string; choices: Choice[]; value: string; onChoose: (value: string) => void; labelStyle?: StyleProp<TextStyle>}) {
  const [chosen, setChosen] = useState<string | null>(null);
  return <SettingsPage title={title} nav={nav} testID="ui-settings-choice-page">
    {choices.map(choice => <SettingRow key={choice.value} testID={`ui-choice-${choice.value}`} label={choice.label} labelStyle={labelStyle} {...(choice.detail ? {detail: choice.detail} : {})}
      selected={(chosen ?? value) === choice.value} onPress={() => {
        setChosen(choice.value); onChoose(choice.value);
      }}/>)}
  </SettingsPage>;
}
export const choicesFrom = (labels: Record<string, string>): Choice[] => Object.entries(labels).map(([value, label]) => ({value, label}));
