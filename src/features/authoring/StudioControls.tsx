import {Text, View} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';
import {PressSurface} from '../../layout/PressSurface';

export function StudioAction({label, onPress, scale: s, disabled = false, selected = false, testID}: {label: string; onPress: () => void; scale: number; disabled?: boolean; selected?: boolean; testID?: string}) {
  const {settings: p} = useAppearance();
  return <PressSurface compact testID={testID} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{disabled, selected}}
    radius={18 * s} highlightColor={p.selected} onPress={onPress} style={{flexShrink: 0, borderWidth: selected ? 0 : 1, borderRadius: 18 * s, borderColor: p.divider}}
    contentStyle={{flex: 0, minHeight: 58 * s, paddingHorizontal: 22 * s, paddingVertical: 13 * s, backgroundColor: selected ? p.primary : p.background, justifyContent: 'center'}}>
    <Text style={{color: selected ? p.onPrimary : p.text, fontSize: 22 * s, lineHeight: 30 * s, fontWeight: '600', textAlign: 'center'}}>{label}</Text>
  </PressSurface>;
}
export function StudioSection({title, scale: s, children}: {title: string; scale: number; children: React.ReactNode}) {
  const {settings: p} = useAppearance();
  return <View style={{gap: 14 * s, marginTop: 26 * s}}><Text accessibilityRole="header" style={{color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s, fontWeight: '600'}}>{title}</Text>{children}</View>;
}
