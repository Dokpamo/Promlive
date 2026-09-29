import type {ReactElement, ReactNode} from 'react';
import {Text, View, useWindowDimensions} from 'react-native';
import {RowPressable} from '../../layout/RowPressable';
import {headerScale} from '../../layout/metrics';
import {panelReference} from '../../layout/panelGeometry';
import {useAppearance} from '../appearance/AppAppearance';
import {SettingsIcon, type SettingsIconName} from './SettingsIcon';

export const settingsMenuGeometry = {height: 84, icon: 38, iconSlot: 46, gap: 28, textInset: 74} as const;

/** Navigation, editable values and switches share a single flat settings grid. */
export function SettingsMenuRow({label, value, detail, icon, onPress, testID, accessibilityLabel, accessibilityValue, accessibilityHint, checked, disabled = false, trailing}: {
  label: string; value?: string; detail?: string; icon: SettingsIconName | ReactElement; onPress: () => void;
  testID?: string; accessibilityLabel?: string; accessibilityValue?: string; accessibilityHint?: string;
  checked?: boolean; disabled?: boolean; trailing?: ReactNode;
}) {
  const {settings: p} = useAppearance();
  const s = headerScale(useWindowDimensions().width);
  const g = settingsMenuGeometry;
  const announcedValue = accessibilityValue ?? value;
  return <RowPressable testID={testID ?? `settings-menu-${label}`}
    accessibilityRole={checked === undefined ? 'button' : 'switch'} accessibilityLabel={accessibilityLabel ?? label}
    accessibilityValue={announcedValue ? {text: announcedValue} : undefined} accessibilityHint={accessibilityHint}
    accessibilityState={{disabled, ...(checked === undefined ? {} : {checked})}} aria-checked={checked}
    disabled={disabled} onPress={onPress} radius={0} style={{marginHorizontal: -panelReference.inset * s, opacity: disabled ? 0.4 : 1}}
    contentStyle={{minHeight: g.height * s, paddingHorizontal: panelReference.inset * s, paddingVertical: 16 * s, flexDirection: 'row', alignItems: 'center', gap: g.gap * s}}>
    <View style={{minWidth: g.iconSlot * s, alignItems: 'center', flexShrink: 0}}>{typeof icon === 'string' ? <SettingsIcon name={icon} size={g.icon * s} color={p.text}/> : icon}</View>
    <View style={{flex: 1, minWidth: 0, gap: 6 * s}}>
      <Text numberOfLines={2} style={{color: p.text, fontSize: 26 * s, lineHeight: 36 * s, includeFontPadding: false}}>{label}</Text>
      {detail && <Text numberOfLines={3} style={{color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s, includeFontPadding: false}}>{detail}</Text>}
    </View>
    {value && <Text numberOfLines={1} style={{maxWidth: '40%', color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s, includeFontPadding: false}}>{value}</Text>}
    {trailing}
  </RowPressable>;
}
