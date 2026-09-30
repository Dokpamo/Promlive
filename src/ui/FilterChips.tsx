import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {filterChipColors, filterChips as m, navigation, uiAppearance} from './tokens';

/** Rounded filters share the same touch targets and header spacing across lists. */
export function FilterChips<T extends string>({scope, items, selected, onChange, scale, appearance = uiAppearance}: {
  scope: 'library' | 'create';
  items: readonly {id: T; label: string}[];
  selected: T;
  onChange: (id: T) => void;
  scale: number;
  appearance?: keyof typeof filterChipColors;
}) {
  const palette = filterChipColors[appearance];
  const chip = {
    minWidth: m.minWidth * scale,
    minHeight: m.height * scale,
    paddingHorizontal: (m.horizontalInset - m.borderWidth) * scale,
    paddingVertical: (m.height - m.lineHeight - m.borderWidth * 2) / 2 * scale,
    borderWidth: m.borderWidth * scale,
  };
  return <ScrollView testID={`ui-${scope}-filters`} horizontal showsHorizontalScrollIndicator={false}
    keyboardShouldPersistTaps="handled" style={[styles.filters, {backgroundColor: palette.surface}]}
    contentContainerStyle={[styles.content, {paddingHorizontal: navigation.titleInset * scale,
      gap: m.gap * scale, paddingBottom: m.bottomInset * scale}]}>
    {items.map(item => {
      const active = selected === item.id;
      return <Pressable key={item.id} testID={`ui-${scope}-filter-${item.id}`}
        accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{selected: active}}
        aria-pressed={active} onPress={() => onChange(item.id)}
        style={({pressed}) => [styles.target, {minHeight: Math.max(48, m.targetHeight * scale), opacity: pressed ? 0.65 : 1}]}>
        <View style={[styles.chip, chip, {backgroundColor: active ? palette.selectedBackground : palette.background,
          borderColor: active ? 'transparent' : palette.border}]}>
          <Text style={[styles.text, {fontSize: m.fontSize * scale, lineHeight: m.lineHeight * scale,
            transform: [{translateY: m.textOffsetY * scale}],
            color: active ? palette.selectedForeground : palette.foreground}]}>{item.label}</Text>
        </View>
      </Pressable>;
    })}
  </ScrollView>;
}

const styles = StyleSheet.create({
  filters: {flexGrow: 0, flexShrink: 0},
  content: {alignItems: 'center'},
  target: {justifyContent: 'center'},
  chip: {borderRadius: 999, alignItems: 'center', justifyContent: 'center'},
  text: {fontWeight: '700', includeFontPadding: false},
});
