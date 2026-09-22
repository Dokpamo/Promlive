import type {ReactNode} from 'react';
import {Text, TextInput, View, type KeyboardTypeOptions} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';
import {PressSurface} from '../../layout/PressSurface';
import {referenceTypography} from '../chat/chatAppearance';
import {SettingsPressable} from './SettingsPressable';
import {SettingsToggleIndicator} from './SettingsToggleIndicator';
import {SwipeBackBoundary} from './SwipeBackModal';
import {settingsReference as r, useSettingsRadius, useSettingsScale} from './SettingsLayout';
import {SettingsTextField} from './SettingsTextField';
import {SettingsSubtitle} from './SettingsSubtitle';

export function AiCaption({children}: {children: ReactNode}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  return <Text style={{color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s, marginHorizontal: r.rowInset * s, marginTop: 16 * s, marginBottom: 24 * s}}>{children}</Text>;
}

export function AiSection({children}: {children: ReactNode}) {
  return <SettingsSubtitle section>{children}</SettingsSubtitle>;
}

export function AiField({label, value, onChange, placeholder, secret = false, keyboard = 'default', detail, multiline = false}: {
  label: string; value: string; onChange: (value: string) => void; placeholder: string;
  secret?: boolean; keyboard?: KeyboardTypeOptions; detail?: string; multiline?: boolean;
}) {
  return <SettingsTextField testID={`ai-field-${label}`} label={label} value={value} onChange={onChange} placeholder={placeholder} secret={secret} keyboard={keyboard} multiline={multiline} {...(detail ? {detail} : {})}/>;
}

/** Search stays beside its results; it does not edit a saved setting. */
export function AiSearchField({label, value, onChange, placeholder}: {label: string; value: string; onChange: (value: string) => void; placeholder: string}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  const radius = useSettingsRadius('control');
  return <View style={{marginBottom: r.groupGap * s}}>
    <SettingsSubtitle>{label}</SettingsSubtitle>
    <SwipeBackBoundary>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={p.faint} autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={500} selectionColor={p.accent} underlineColorAndroid="transparent" style={{minHeight: 84 * s, borderRadius: radius, backgroundColor: p.surface, paddingHorizontal: 24 * s, paddingVertical: 20 * s, color: p.text, fontSize: 25 * s, lineHeight: 36 * s, includeFontPadding: false}}/>
    </SwipeBackBoundary>
  </View>;
}

export function AiToggle({label, detail, value, onChange}: {label: string; detail?: string; value: boolean; onChange: (value: boolean) => void}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  return <SwipeBackBoundary><SettingsPressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{checked: value}} aria-checked={value} onPress={() => onChange(!value)} radius={useSettingsRadius('control')} highlightInset={r.highlightInset * s} contentStyle={{minHeight: r.rowHeight * s, paddingHorizontal: r.rowInset * s, paddingVertical: r.rowPadding * s, flexDirection: 'row', alignItems: 'center', gap: 22 * s}}>
    <View style={{flex: 1, gap: 6 * s}}><Text style={{color: p.text, fontSize: r.rowFont * s, lineHeight: r.rowLine * s, fontWeight: referenceTypography.titleWeight}}>{label}</Text>{detail && <Text style={{color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s}}>{detail}</Text>}</View>
    <SettingsToggleIndicator value={value}/>
  </SettingsPressable></SwipeBackBoundary>;
}

export function AiAction({label, onPress, primary = false}: {label: string; onPress: () => void; primary?: boolean}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  const radius = useSettingsRadius('control');
  return <PressSurface accessibilityRole="button" accessibilityLabel={label} onPress={onPress} radius={radius} highlightColor={primary ? p.onPrimary : p.selected} highlightOpacity={primary ? 0.08 : 1} style={{marginTop: 16 * s}} contentStyle={{backgroundColor: primary ? p.primary : p.surface, minHeight: 82 * s, alignItems: 'center', justifyContent: 'center', padding: 18 * s}}><Text style={{color: primary ? p.onPrimary : p.text, fontSize: 26 * s}}>{label}</Text></PressSurface>;
}
