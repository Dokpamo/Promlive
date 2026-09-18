import {useState, type ReactNode} from 'react';
import {Pressable, Text, View, TextInput, StyleSheet, type StyleProp, type ViewStyle, type TextInputProps} from 'react-native';
import {colors, styles} from './theme';

export function Icon({name, size = 19, color = colors.muted}: {name: string; size?: number; color?: string}) {
  const glyphs: Record<string, string> = {library: '▤', plus: '+', chat: '◌', star: '✧', starFill: '✦', archive: '▣', settings: '⚙', arrow: '↗', back: '‹', close: '×', check: '✓', search: '⌕', code: '‹›', world: '◎', people: '♧', spark: '✧', send: '↑', stop: '■', dots: '···', leaf: '❧', copy: '⧉'};
  return <Text accessible={false} style={{fontSize: size, color, lineHeight: size + 6, fontWeight: '400', textAlign: 'center'}}>{glyphs[name] ?? name}</Text>;
}
export function Button({children, onPress, icon, variant = 'primary', disabled = false, small = false, style, testID}: {children: ReactNode; onPress: () => void; icon?: string; variant?: 'primary' | 'secondary' | 'ghost'; disabled?: boolean; small?: boolean; style?: StyleProp<ViewStyle>; testID?: string}) {
  const [hover, setHover] = useState(false);
  const primary = variant === 'primary';
  return <Pressable accessibilityRole="button" accessibilityState={{disabled}} onPress={onPress} disabled={disabled} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)} {...(testID ? {testID} : {})} style={({pressed}) => [{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: small ? 12 : 17, paddingVertical: small ? 8 : 12, minHeight: small ? 36 : 44, borderRadius: 8, backgroundColor: primary ? colors.accent : variant === 'secondary' ? '#FFF' : 'transparent', borderWidth: variant === 'secondary' ? 1 : 0, borderColor: colors.line, opacity: disabled ? 0.45 : pressed ? 0.65 : hover ? 0.85 : 1}, style]}>
    {icon && <Icon name={icon} size={16} color={primary ? '#FFF' : colors.ink}/>}
    <Text style={{fontSize: small ? 12 : 13, fontWeight: '600', color: primary ? '#FFF' : colors.ink}}>{children}</Text>
  </Pressable>;
}
export function Field({label, hint, multiline = false, style, ...props}: TextInputProps & {label: string; hint?: string}) {
  return <View style={{gap: 8}}><Text style={{fontSize: 13, fontWeight: '600', color: colors.ink}}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.faint} multiline={multiline} {...props} style={[styles.field, multiline && {minHeight: 112}, style]}/>{hint && <Text style={styles.small}>{hint}</Text>}</View>;
}
export function Pill({children, active = false, onPress}: {children: ReactNode; active?: boolean; onPress?: () => void}) {
  return <Pressable accessibilityRole={onPress ? 'button' : 'text'} accessibilityState={{selected: active}} onPress={onPress} style={{paddingHorizontal: 13, paddingVertical: 8, borderRadius: 7, backgroundColor: active ? colors.ink : '#F0EEE8'}}><Text style={{fontSize: 12, color: active ? '#FFF' : colors.muted, fontWeight: active ? '600' : '400'}}>{children}</Text></Pressable>;
}
export function Empty({icon = 'world', title, children, action}: {icon?: string; title: string; children: ReactNode; action?: ReactNode}) {
  return <View style={{alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14}}><View style={{padding: 18, borderRadius: 24, backgroundColor: colors.accentSoft}}><Icon name={icon} size={30} color={colors.accent}/></View><Text style={styles.subheading}>{title}</Text><Text style={[styles.small, {textAlign: 'center', maxWidth: 320}]}>{children}</Text>{action}</View>;
}
export function Cover({kind, large = false}: {kind: 'moon' | 'forest' | 'sunset' | 'code'; large?: boolean}) {
  const backgroundColor = {moon: '#DDDBE9', forest: '#DDE4D6', sunset: '#EDDBD0', code: '#DDE1E7'}[kind];
  return <View accessible={false} style={{height: large ? 222 : 152, backgroundColor, overflow: 'hidden', justifyContent: 'center', alignItems: 'center'}}>
    <View style={{position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: '#ffffff66', transform: [{rotate: '-20deg'}], left: '15%', top: -75}}/>
    <View style={{position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 1, borderColor: '#ffffff55', right: -40, top: 35}}/>
    {kind === 'moon' && <><View style={{position: 'absolute', width: 68, height: 68, borderRadius: 34, backgroundColor: '#F9F5EA', top: 27, right: '25%'}}/><View style={{position: 'absolute', width: 60, height: 62, borderRadius: 31, backgroundColor, top: 16, right: '22%'}}/><Text style={{position: 'absolute', top: 30, left: '23%', fontSize: 22, color: '#FFF'}}>✧</Text><View style={{width: 116, height: 78, borderTopLeftRadius: 55, borderTopRightRadius: 55, borderWidth: 1, borderColor: '#898198', position: 'absolute', bottom: -8, backgroundColor: '#B7ADC5'}}><View style={{margin: 13, flex: 1, borderTopLeftRadius: 35, borderTopRightRadius: 35, borderWidth: 1, borderColor: '#E8E2EE'}}/></View></>}
    {kind === 'forest' && <><View style={{position: 'absolute', width: 100, height: 150, borderTopLeftRadius: 80, borderTopRightRadius: 10, borderBottomRightRadius: 80, backgroundColor: '#A3B397', transform: [{rotate: '-30deg'}], bottom: -30, left: '22%'}}/><View style={{position: 'absolute', width: 70, height: 130, borderTopLeftRadius: 10, borderTopRightRadius: 70, borderBottomLeftRadius: 70, backgroundColor: '#788D6F', transform: [{rotate: '35deg'}], bottom: -20, right: '25%'}}/><View style={{width: 64, height: 46, backgroundColor: '#F5F0DE', borderRadius: 3, transform: [{rotate: '-12deg'}], marginTop: 6, borderWidth: 1, borderColor: '#C8C3AE'}}><Text style={{fontSize: 31, color: '#B5A890', textAlign: 'center', marginTop: -11}}>⌄</Text></View></>}
    {kind === 'sunset' && <><View style={{height: 89, width: 89, borderRadius: 45, backgroundColor: '#D39C7A', marginTop: 30}}/><View style={{position: 'absolute', height: 82, width: '120%', backgroundColor: '#C4B2AF', bottom: -54, transform: [{rotate: '-11deg'}]}}/><View style={{position: 'absolute', height: 1, backgroundColor: '#9D858080', width: '110%', top: '53%', transform: [{rotate: '-18deg'}]}}/><View style={{position: 'absolute', height: 13, width: 13, borderRadius: 7, backgroundColor: '#F7EFE4', top: 34, left: '28%'}}/></>}
    {kind === 'code' && <Text style={{fontSize: 62, color: '#8B91A5', fontWeight: '200'}}>〈 / 〉</Text>}
    <Text style={{position: 'absolute', bottom: 13, left: 16, fontSize: 8, letterSpacing: 2.2, color: '#53505A99'}}>YE O B A E K  /  STORIES</Text>
  </View>;
}
export const cardStyles = StyleSheet.create({panel: {backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 12, overflow: 'hidden'}});
