import {useTheme} from './Theme';
import {useCallback, useEffect, useRef} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {filterChipColors, filterChips as m, navigation} from './tokens';

/** Rounded filters share the same touch targets and header spacing across lists. */
export function FilterChips<T extends string>({scope, items, selected, onChange, scale, appearance}: {
  scope: 'library' | 'create' | 'editor';
  items: readonly {id: T; label: string}[];
  selected: T;
  onChange: (id: T) => void;
  scale: number;
  appearance?: keyof typeof filterChipColors;
}) {
  const theme = useTheme();
  const palette = filterChipColors[appearance ?? theme.appearance];
  const scroll = useRef<ScrollView>(null);
  const measurements = useRef({viewport: 0, content: 0, offset: 0, items: {} as Record<string, {x: number; width: number}>});
  const revealSelection = useCallback(() => {
    const {viewport, content, offset, items: bounds} = measurements.current;
    const item = bounds[selected];
    if (!item || viewport <= 0 || content <= 0) return;
    const inset = navigation.titleInset * scale;
    const wanted = item.x < offset + inset ? item.x - inset
      : item.x + item.width > offset + viewport - inset ? item.x + item.width - viewport + inset : offset;
    const x = Math.max(0, Math.min(content - viewport, wanted));
    if (Math.abs(x - offset) < 1) return;
    measurements.current.offset = x;
    scroll.current?.scrollTo({x, animated: false});
  }, [selected, scale]);
  useEffect(revealSelection, [revealSelection]);
  const chip = {
    minWidth: m.minWidth * scale,
    minHeight: m.height * scale,
    paddingHorizontal: (m.horizontalInset - m.borderWidth) * scale,
    paddingVertical: (m.height - m.lineHeight - m.borderWidth * 2) / 2 * scale,
    borderWidth: m.borderWidth * scale,
  };
  return <ScrollView ref={scroll} testID={`ui-${scope}-filters`} horizontal showsHorizontalScrollIndicator={false}
    onLayout={event => {measurements.current.viewport = event.nativeEvent.layout.width; revealSelection();}}
    onContentSizeChange={width => {measurements.current.content = width; revealSelection();}}
    onScroll={event => {measurements.current.offset = event.nativeEvent.contentOffset.x;}} scrollEventThrottle={16}
    keyboardShouldPersistTaps="handled" style={[styles.filters, {backgroundColor: palette.surface}]}
    contentContainerStyle={[styles.content, {paddingHorizontal: navigation.titleInset * scale,
      gap: m.gap * scale, paddingBottom: m.bottomInset * scale}]}>
    {items.map(item => {
      const active = selected === item.id;
      return <Pressable key={item.id} testID={`ui-${scope}-filter-${item.id}`}
        onLayout={event => {measurements.current.items[item.id] = event.nativeEvent.layout; if (active) revealSelection();}}
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
