import {useState, type ReactNode} from 'react';
import {Text, TextInput, View, type KeyboardTypeOptions} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';
import {PressSurface} from '../../layout/PressSurface';
import {referenceTypography} from '../chat/chatAppearance';
import {SettingsPressable} from './SettingsPressable';
import {SettingsToggleIndicator} from './SettingsToggleIndicator';
import {SwipeBackBoundary} from './SwipeBackModal';
import {settingsReference as r, useSettingsRadius, useSettingsScale} from './SettingsLayout';

export function AiCaption({children}: {children: ReactNode}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  return <Text style={{color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s, marginHorizontal: 6 * s, marginTop: 16 * s, marginBottom: 24 * s}}>{children}</Text>;
}

export function AiSection({children}: {children: ReactNode}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  return <Text accessibilityRole="header" style={{color: p.secondary, fontSize: 24 * s, lineHeight: 34 * s, marginHorizontal: r.rowInset * s, marginTop: 14 * s, marginBottom: 16 * s}}>{children}</Text>;
}

export function AiField({label, value, onChange, placeholder, secret = false, keyboard = 'default', detail, multiline = false}: {
  label: string; value: string; onChange: (value: string) => void; placeholder: string;
  secret?: boolean; keyboard?: KeyboardTypeOptions; detail?: string; multiline?: boolean;
}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  const radius = useSettingsRadius('control');
  const [revealed, setRevealed] = useState(false);
  return <View style={{marginBottom: 26 * s}}>
    <Text style={{color: p.secondary, fontSize: 24 * s, lineHeight: 34 * s, marginBottom: 12 * s, marginHorizontal: 6 * s}}>{label}</Text>
    <SwipeBackBoundary>
      <View style={{minHeight: 84 * s, borderRadius: radius, backgroundColor: p.surface, flexDirection: 'row', alignItems: 'center', overflow: 'hidden'}}>
        <TextInput testID={`ai-field-${label}`} accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={p.faint} secureTextEntry={secret && !revealed} autoCapitalize="none" autoCorrect={false} autoComplete="off" keyboardType={keyboard} multiline={multiline} maxLength={secret ? 1024 : 500} selectionColor={p.accent} underlineColorAndroid="transparent" style={{flex: 1, minWidth: 0, minHeight: 84 * s, paddingHorizontal: 24 * s, paddingVertical: 20 * s, color: p.text, fontSize: 25 * s, lineHeight: 36 * s, includeFontPadding: false}}/>
        {secret && <SettingsPressable accessibilityRole="button" accessibilityLabel={revealed ? 'API 키 숨기기' : 'API 키 표시'} onPress={() => setRevealed(!revealed)} radius={radius} style={{marginRight: 8 * s}} contentStyle={{minHeight: 64 * s, paddingHorizontal: 16 * s, justifyContent: 'center'}}><Text style={{color: p.secondary, fontSize: 22 * s}}>{revealed ? '숨기기' : '보기'}</Text></SettingsPressable>}
      </View>
    </SwipeBackBoundary>
    {detail && <Text style={{color: p.secondary, fontSize: 21 * s, lineHeight: 31 * s, marginTop: 10 * s, marginHorizontal: 6 * s}}>{detail}</Text>}
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
