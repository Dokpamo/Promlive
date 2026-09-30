import {Pressable, StyleSheet, Text, View} from 'react-native';
import {PreviewArtwork} from './PreviewArtwork';
import {colors} from './tokens';

/** Chat and creation rows use the same avatar, text alignment, and hit area. */
export function ContentRow({scope, id, title, subtitle, timestamp, tile, accessibilityLabel, onPress}: {
  scope: 'chat' | 'creation';
  id: string;
  title: string;
  subtitle: string;
  timestamp: string;
  tile: number;
  accessibilityLabel: string;
  onPress?: () => void;
}) {
  const content = <>
    <View testID={`ui-${scope}-avatar-${id}`} style={styles.avatar}>
      <PreviewArtwork tile={tile} width={60} height={60}/>
    </View>
    <View style={styles.text}>
      <View style={styles.titleRow}>
        <Text testID={`ui-${scope}-title-${id}`} numberOfLines={1} ellipsizeMode="tail" style={styles.title}>{title}</Text>
        <Text testID={`ui-${scope}-time-${id}`} numberOfLines={1} style={styles.timestamp}>{timestamp}</Text>
      </View>
      <Text testID={`ui-${scope}-${scope === 'chat' ? 'message' : 'summary'}-${id}`}
        numberOfLines={1} ellipsizeMode="tail" style={styles.subtitle}>{subtitle}</Text>
    </View>
  </>;
  return onPress
    ? <Pressable testID={`ui-${scope}-row-${id}`} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
        onPress={onPress} style={({pressed}) => [styles.row, {opacity: pressed ? 0.6 : 1}]}>{content}</Pressable>
    : <View testID={`ui-${scope}-row-${id}`} accessible accessibilityLabel={accessibilityLabel} style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {minHeight: 88, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingLeft: 22, paddingRight: 20, gap: 20},
  avatar: {width: 60, height: 60, flexShrink: 0, borderRadius: 30, overflow: 'hidden', backgroundColor: colors.surface},
  text: {flex: 1, minWidth: 0, gap: 4},
  titleRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  title: {flex: 1, minWidth: 0, fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.foreground, includeFontPadding: false},
  timestamp: {flexShrink: 0, fontSize: 12, lineHeight: 18, color: colors.secondaryForeground, includeFontPadding: false},
  subtitle: {fontSize: 16, lineHeight: 22, color: colors.secondaryForeground, includeFontPadding: false},
});
