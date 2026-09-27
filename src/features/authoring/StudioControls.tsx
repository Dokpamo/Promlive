import {Text, View} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';
import {PressSurface} from '../../layout/PressSurface';

export function StudioAction({label, onPress, scale: s, disabled = false, selected = false, testID}: {label: string; onPress: () => void; scale: number; disabled?: boolean; selected?: boolean; testID?: string}) {
  const {settings: p} = useAppearance();
  return <PressSurface compact testID={testID} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{disabled, selected}}
    radius={32 * s} highlightColor={p.selected} onPress={onPress} style={{flexShrink: 0}} contentStyle={{flex: 0, minHeight: 58 * s, paddingHorizontal: 22 * s, paddingVertical: 13 * s, backgroundColor: selected ? p.selected : p.surface, justifyContent: 'center'}}>
    <Text style={{color: p.text, fontSize: 22 * s, lineHeight: 30 * s, textAlign: 'center'}}>{label}</Text>
  </PressSurface>;
}
export function StudioSection({title, scale: s, children}: {title: string; scale: number; children: React.ReactNode}) {
  const {settings: p} = useAppearance();
  return <View style={{gap: 14 * s, marginTop: 26 * s}}><Text accessibilityRole="header" style={{color: p.text, fontSize: 29 * s, lineHeight: 40 * s, marginHorizontal: 16 * s}}>{title}</Text>{children}</View>;
}
