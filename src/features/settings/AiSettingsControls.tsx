import type {ReactNode} from 'react';
import {Text, View, type KeyboardTypeOptions} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';
import {PressSurface} from '../../layout/PressSurface';
import {referenceTypography} from '../../layout/metrics';
import {RowPressable} from '../../layout/RowPressable';
import {SettingsToggleIndicator} from './SettingsToggleIndicator';
import {SwipeBackBoundary} from '../../layout/SwipeBackModal';
import {panelReference as r, useSettingsRadius, useSettingsScale} from './SettingsLayout';
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

export function AiField({label, value, onChange, placeholder, secret = false, keyboard = 'default', detail, multiline = false, editor = 'full', resetValue}: {
  label: string; value: string; onChange: (value: string) => void; placeholder: string;
  secret?: boolean; keyboard?: KeyboardTypeOptions; detail?: string; multiline?: boolean;
  editor?: 'full' | 'mini'; resetValue?: string;
}) {
  return <SettingsTextField testID={`ai-field-${label}`} label={label} value={value} onChange={onChange} placeholder={placeholder} secret={secret} keyboard={keyboard} multiline={multiline} editor={editor} {...(resetValue !== undefined ? {resetValue} : {})} {...(detail ? {detail} : {})}/>;
}

export function AiToggle({label, detail, value, onChange}: {label: string; detail?: string; value: boolean; onChange: (value: boolean) => void}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  return <SwipeBackBoundary><RowPressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{checked: value}} aria-checked={value} onPress={() => onChange(!value)} radius={useSettingsRadius('control')} highlightInset={r.highlightInset * s} contentStyle={{minHeight: r.rowHeight * s, paddingHorizontal: r.rowInset * s, paddingVertical: r.rowPadding * s, flexDirection: 'row', alignItems: 'center', gap: 22 * s}}>
    <View style={{flex: 1, gap: 6 * s}}><Text style={{color: p.text, fontSize: r.rowFont * s, lineHeight: r.rowLine * s, fontWeight: referenceTypography.titleWeight}}>{label}</Text>{detail && <Text style={{color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s}}>{detail}</Text>}</View>
    <SettingsToggleIndicator value={value}/>
  </RowPressable></SwipeBackBoundary>;
}

export function AiAction({label, onPress, primary = false, disabled = false}: {label: string; onPress: () => void; primary?: boolean; disabled?: boolean}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  const radius = useSettingsRadius('control');
  return <PressSurface accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} radius={radius} highlightColor={primary ? p.onPrimary : p.selected} highlightOpacity={primary ? 0.08 : 1} style={{marginTop: 16 * s}} contentStyle={{backgroundColor: primary ? p.primary : p.surface, minHeight: 82 * s, alignItems: 'center', justifyContent: 'center', padding: 18 * s}}><Text style={{color: primary ? p.onPrimary : p.text, fontSize: 26 * s}}>{label}</Text></PressSurface>;
}
