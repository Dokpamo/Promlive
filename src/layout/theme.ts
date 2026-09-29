import {Platform, StyleSheet} from 'react-native';
import {useMemo} from 'react';
import {useAppearance} from '../features/appearance/AppAppearance';
import {lightChatColors, type ChatColors} from '../features/chat/chatAppearance';
const palette = (c: ChatColors) => ({bg: c.background, panel: c.background, side: c.search, ink: c.text, muted: c.muted, faint: c.placeholder, line: c.divider, accent: c.send, accentSoft: c.bubble, sage: c.search, sageInk: c.muted, danger: c.error});
export const colors = palette(lightChatColors);
export const mono = Platform.OS === 'ios' || Platform.OS === 'macos' ? 'Menlo' : 'monospace';
const makeStyles = (colors: ReturnType<typeof palette>) => StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center'},
  body: {fontSize: 14, lineHeight: 23, color: colors.ink},
  small: {fontSize: 12, lineHeight: 19, color: colors.muted},
  eyebrow: {fontSize: 10, letterSpacing: 2.5, color: colors.muted, fontWeight: '600'},
  heading: {fontSize: 27, fontWeight: '600', letterSpacing: -0.9, color: colors.ink},
  subheading: {fontSize: 17, fontWeight: '600', letterSpacing: -0.3, color: colors.ink},
  field: {borderWidth: 1, borderColor: colors.line, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, lineHeight: 23, color: colors.ink, backgroundColor: colors.side, textAlignVertical: 'top'},
  divider: {height: 1, backgroundColor: colors.line},
  badge: {backgroundColor: colors.accentSoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 5},
});

export const styles = makeStyles(colors);
/** Older code-card controls use the same current app palette as the main screens. */
export function useTheme() {
  const {colors: appColors} = useAppearance();
  return useMemo(() => {const colors = palette(appColors); return {colors, styles: makeStyles(colors)};}, [appColors]);
}
