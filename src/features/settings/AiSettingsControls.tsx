import type {ReactNode} from 'react';
import {Text, type KeyboardTypeOptions} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';
import {SettingsToggleIndicator} from './SettingsToggleIndicator';
import {SwipeBackBoundary} from '../../layout/SwipeBackModal';
import {useSettingsScale} from './SettingsLayout';
import {SettingsTextField} from './SettingsTextField';
import {SettingsSubtitle} from './SettingsSubtitle';
import {SettingsMenuRow, settingsMenuGeometry} from './SettingsMenuRow';
import type {SettingsIconName} from './SettingsIcon';

export function AiCaption({children}: {children: ReactNode}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  return <Text style={{color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s, marginLeft: settingsMenuGeometry.textInset * s, marginTop: 16 * s, marginBottom: 24 * s}}>{children}</Text>;
}

export function AiSection({children}: {children: ReactNode}) {
  return <SettingsSubtitle section inset={settingsMenuGeometry.textInset}>{children}</SettingsSubtitle>;
}

export function AiField({label, value, onChange, placeholder, secret = false, keyboard = 'default', detail, multiline = false, editor = 'full', resetValue, icon}: {
  label: string; value: string; onChange: (value: string) => void; placeholder: string;
  secret?: boolean; keyboard?: KeyboardTypeOptions; detail?: string; multiline?: boolean;
  editor?: 'full' | 'mini'; resetValue?: string; icon?: SettingsIconName;
}) {
  return <SettingsTextField testID={`ai-field-${label}`} label={label} value={value} onChange={onChange} placeholder={placeholder} secret={secret} keyboard={keyboard} multiline={multiline} editor={editor} {...(icon ? {icon} : {})} {...(resetValue !== undefined ? {resetValue} : {})} {...(detail ? {detail} : {})}/>;
}

export function AiToggle({label, detail, value, onChange, icon = 'connection'}: {label: string; detail?: string; value: boolean; onChange: (value: boolean) => void; icon?: SettingsIconName}) {
  return <SwipeBackBoundary><SettingsMenuRow icon={icon} label={label} {...(detail ? {detail} : {})} checked={value}
    onPress={() => onChange(!value)} trailing={<SettingsToggleIndicator value={value}/>}/></SwipeBackBoundary>;
}

export function AiAction({label, onPress, primary = false, disabled = false}: {label: string; onPress: () => void; primary?: boolean; disabled?: boolean}) {
  return <SettingsMenuRow icon={primary ? 'model' : 'response'} label={label} onPress={onPress} disabled={disabled}/>;
}
