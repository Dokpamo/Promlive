import {Platform, StyleSheet} from 'react-native';
export const colors = {bg: '#FAF9F6', panel: '#FFFFFF', side: '#F1F0EB', ink: '#302F2C', muted: '#88857E', faint: '#B3ADA2', line: '#E8E5DE', accent: '#7B638C', accentSoft: '#ECE5F1', sage: '#E5EBDD', sageInk: '#68735A', danger: '#9C4E42'};
export const mono = Platform.OS === 'ios' || Platform.OS === 'macos' ? 'Menlo' : 'monospace';
export const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center'},
  body: {fontSize: 14, lineHeight: 23, color: colors.ink},
  small: {fontSize: 12, lineHeight: 19, color: colors.muted},
  eyebrow: {fontSize: 10, letterSpacing: 2.5, color: colors.muted, fontWeight: '600'},
  heading: {fontSize: 27, fontWeight: '600', letterSpacing: -0.9, color: colors.ink},
  subheading: {fontSize: 17, fontWeight: '600', letterSpacing: -0.3, color: colors.ink},
  field: {borderWidth: 1, borderColor: colors.line, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, lineHeight: 23, color: colors.ink, backgroundColor: '#FFF', textAlignVertical: 'top'},
  divider: {height: 1, backgroundColor: colors.line},
  badge: {backgroundColor: colors.accentSoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 5},
});
