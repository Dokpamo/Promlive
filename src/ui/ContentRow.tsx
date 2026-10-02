import {themedStyles} from './Theme';
import {Text, View} from 'react-native';
import {ListPressable} from './ListPressable';
import {PreviewArtwork} from './PreviewArtwork';
import {listTypography} from './tokens';

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
  const styles = useStyles();
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
    ? <ListPressable testID={`ui-${scope}-row-${id}`} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
        onPress={onPress} style={styles.row}>{content}</ListPressable>
    : <View testID={`ui-${scope}-row-${id}`} accessible accessibilityLabel={accessibilityLabel} style={styles.row}>{content}</View>;
}

const useStyles = themedStyles(colors => ({
  row: {minHeight: 88, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingLeft: 22, paddingRight: 20, gap: 20},
  avatar: {width: 60, height: 60, flexShrink: 0, borderRadius: 30, overflow: 'hidden', backgroundColor: colors.surface},
  text: {flex: 1, minWidth: 0, gap: 4},
  titleRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  title: {...listTypography, flex: 1, minWidth: 0, fontWeight: '600', color: colors.foreground},
  timestamp: {flexShrink: 0, fontSize: 12, lineHeight: 18, color: colors.secondaryForeground, includeFontPadding: false},
  subtitle: {...listTypography, color: colors.secondaryForeground},
}));
