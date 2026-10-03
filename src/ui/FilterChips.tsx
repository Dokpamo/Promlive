import {useTheme} from './Theme';
import {useCallback, useEffect, useRef} from 'react';
import {type ScrollView, StyleSheet, Text, View} from 'react-native';
import {FilterScrollView} from './FilterScrollView';
import type {GestureBlockRef} from './HorizontalGesture.types';
import {Icon, type IconName} from './Icon';
import {filterChipColors, filterChips as m, navigation} from './tokens';
import {useDesktopPane} from './desktop/DesktopPane';
import {HoverPressable} from './desktop/DesktopFeedback';

/** Rounded filters share the same touch targets and header spacing across lists. */
export function FilterChips<T extends string>({scope, items, selected, onChange, scale, appearance, horizontalInset = navigation.titleInset * scale, blockerRef, trailingAction}: {
  scope: 'library' | 'create' | 'editor' | 'personas';
  items: readonly {id: T; label: string; disabled?: boolean; onLongPress?: () => void}[];
  selected: T | readonly T[];
  onChange: (id: T) => void;
  scale: number;
  appearance?: keyof typeof filterChipColors;
  horizontalInset?: number;
  blockerRef?: GestureBlockRef;
  trailingAction?: {label: string; icon: IconName; onPress: () => void; disabled?: boolean; testID?: string} | undefined;
}) {
  const theme = useTheme(), desktop = useDesktopPane();
  const palette = filterChipColors[appearance ?? theme.appearance];
  const scroll = useRef<ScrollView>(null);
  const measurements = useRef({viewport: 0, content: 0, offset: 0, items: {} as Record<string, {x: number; width: number}>});
  const revealSelection = useCallback(() => {
    const {viewport, content, offset, items: bounds} = measurements.current;
    const id = typeof selected === 'string' ? selected : selected.at(-1);
    const item = id ? bounds[id] : undefined;
    if (!item || viewport <= 0 || content <= 0) return;
    const inset = horizontalInset;
    const wanted = item.x < offset + inset ? item.x - inset
      : item.x + item.width > offset + viewport - inset ? item.x + item.width - viewport + inset : offset;
    const x = Math.max(0, Math.min(content - viewport, wanted));
    if (Math.abs(x - offset) < 1) return;
    measurements.current.offset = x;
    scroll.current?.scrollTo({x, animated: false});
  }, [selected, horizontalInset]);
  useEffect(revealSelection, [revealSelection]);
  const chip = {
    minWidth: m.minWidth * scale,
    minHeight: m.height * scale,
    paddingHorizontal: (m.horizontalInset - m.borderWidth) * scale,
    paddingVertical: (m.height - m.lineHeight - m.borderWidth * 2) / 2 * scale,
    borderWidth: m.borderWidth * scale,
  };
  return <FilterScrollView ref={scroll} {...(blockerRef ? {blockerRef} : {})} testID={`ui-${scope}-filters`} horizontal showsHorizontalScrollIndicator={false}
    onLayout={event => {measurements.current.viewport = event.nativeEvent.layout.width; revealSelection();}}
    onContentSizeChange={width => {measurements.current.content = width; revealSelection();}}
    onScroll={event => {measurements.current.offset = event.nativeEvent.contentOffset.x;}} scrollEventThrottle={16}
    keyboardShouldPersistTaps="handled" style={[styles.filters, {backgroundColor: palette.surface}]}
    contentContainerStyle={[styles.content, {paddingHorizontal: horizontalInset,
      gap: m.gap * scale, paddingBottom: m.bottomInset * scale}]}>
    {items.map(item => {
      const checkable = typeof selected !== 'string';
      const active = typeof selected === 'string' ? selected === item.id : selected.includes(item.id);
      return <HoverPressable key={item.id} testID={`ui-${scope}-filter-${item.id}`} selected={active} feedback="none"
        onLayout={event => {measurements.current.items[item.id] = event.nativeEvent.layout; if (active) revealSelection();}}
        accessibilityRole={checkable ? 'checkbox' : 'button'} accessibilityLabel={item.label}
        accessibilityState={{disabled: !!item.disabled, ...(checkable ? {checked: active} : {selected: active})}}
        aria-pressed={!checkable ? active : undefined} aria-checked={checkable ? active : undefined}
        onLongPress={item.onLongPress}
        {...(item.onLongPress ? {accessibilityHint: '길게 눌러 선택', accessibilityActions: [{name: 'longpress', label: '선택'}],
          onAccessibilityAction: (event: {nativeEvent: {actionName: string}}) => {if (event.nativeEvent.actionName === 'longpress') item.onLongPress?.();}} : {})}
        disabled={item.disabled} onPress={() => onChange(item.id)}
        style={[styles.target, {minHeight: Math.max(desktop ? 36 : 48, m.targetHeight * scale), opacity: item.disabled ? .4 : 1}]}>
        {hovered => <View style={[styles.chip, chip, {backgroundColor: active || hovered ? palette.selectedBackground : palette.background,
          borderColor: active || hovered ? 'transparent' : palette.border}]}>
          <Text numberOfLines={1} style={[styles.text, {fontSize: m.fontSize * scale, lineHeight: m.lineHeight * scale,
            transform: [{translateY: m.textOffsetY * scale}],
            color: active || hovered ? palette.selectedForeground : palette.foreground}]}>{item.label}</Text>
        </View>}
      </HoverPressable>;
    })}
    {trailingAction && <HoverPressable feedback="none" testID={trailingAction.testID} accessibilityRole="button" accessibilityLabel={trailingAction.label}
      accessibilityState={{disabled: !!trailingAction.disabled}} disabled={trailingAction.disabled} onPress={trailingAction.onPress}
      style={[styles.target, {minHeight: Math.max(desktop ? 36 : 48, m.targetHeight * scale), opacity: trailingAction.disabled ? .4 : 1}]}>
      {hovered => <View style={[styles.chip, {height: m.height * scale, minWidth: m.height * scale, paddingHorizontal: 16 * scale,
        borderWidth: m.borderWidth * scale, backgroundColor: hovered ? palette.selectedBackground : palette.background, borderColor: hovered ? 'transparent' : palette.border}]}>
        <Icon name={trailingAction.icon} size={36 * scale} color={hovered ? palette.selectedForeground : palette.foreground}/>
      </View>}
    </HoverPressable>}
  </FilterScrollView>;
}

const styles = StyleSheet.create({
  filters: {flexGrow: 0, flexShrink: 0},
  content: {alignItems: 'center'},
  target: {justifyContent: 'center'},
  chip: {borderRadius: 999, alignItems: 'center', justifyContent: 'center'},
  text: {fontWeight: '700', includeFontPadding: false},
});
