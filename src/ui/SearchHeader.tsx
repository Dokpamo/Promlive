import {useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {Animated, BackHandler, Easing, Platform, StyleSheet, TextInput, View, useWindowDimensions} from 'react-native';
import {BodyPageContext} from './BodyMotion';
import {Icon} from './Icon';
import {SearchField, type SearchScope} from './SearchField';
import {ScreenActiveContext} from './ScreenLayer';
import {usePalette} from './Theme';
import {navigation, navigationActionMetrics} from './tokens';
import {useReducedMotion} from './useReducedMotion';
import {useDesktopPane} from './desktop/DesktopPane';
import {HoverPressable} from './desktop/DesktopFeedback';
import {useDesktopSearchDismissal} from './desktop/DesktopSearchDismissal';

export type HeaderSearch = {
  scope: SearchScope;
  open: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
};

/** One fixed header line. Only its background stretches; text and SVGs keep their size. */
export function SearchHeader({children, search, scale, height, trailingWidth = 0, actionInset, fieldInset, backInset}: {
  children: ReactNode; search: HeaderSearch; scale: number; height: number; trailingWidth?: number;
  actionInset?: number; fieldInset?: number; backInset?: number;
}) {
  const colors = usePalette(), desktop = useDesktopPane(), window = useWindowDimensions();
  const {headerVisible} = useContext(BodyPageContext);
  const screenActive = useContext(ScreenActiveContext), active = headerVisible && screenActive;
  const reducedMotion = useReducedMotion();
  const latest = useRef({search, active, reducedMotion});
  latest.current = {search, active, reducedMotion};
  const input = useRef<TextInput>(null);
  const inputReady = useRef(Platform.OS !== 'android'), requestFocus = useRef(false);
  const focusFrame = useRef<number | null>(null);
  const boundary = useRef<View>(null);
  useDesktopSearchDismissal(boundary, !!desktop && search.open && active && !search.query.trim(), search.onClose);
  const progress = useRef(new Animated.Value(search.open ? 1 : 0)).current;
  const previousOpen = useRef(search.open);
  const [retained, setRetained] = useState(search.open), [settled, setSettled] = useState(true);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const width = measuredWidth || desktop?.width || window.width;
  const buttonSize = desktop ? 40 : navigationActionMetrics(scale).size;
  const fieldHeight = desktop ? 40 : 44, radius = desktop ? 12 : 14;
  const backLeft = backInset ?? (desktop ? 16 : navigation.backInset);
  const fieldLeft = backLeft + buttonSize + (desktop ? 8 : 6);
  const fieldRight = width - (fieldInset ?? (desktop ? 28 : navigation.titleInset * scale));
  const fieldWidth = Math.max(fieldHeight, fieldRight - fieldLeft);
  const sourceCenter = width - (actionInset ?? (desktop ? 16 : navigation.actionInset * scale)) - trailingWidth - buttonSize / 2;
  const half = fieldHeight / 2;
  const sourceLeft = sourceCenter - half;
  const motion = useMemo(() => {
    const interpolate = (inputRange: number[], outputRange: number[]) => progress.interpolate({inputRange, outputRange, extrapolate: 'clamp'});
    return {
      normal: {opacity: interpolate([0, .5, 1], [1, 0, 0]), transform: [{translateX: interpolate([0, 1], [0, -8])}]},
      radius: interpolate([0, 1], [half, radius]),
      left: {transform: [{translateX: interpolate([0, 1], [sourceLeft - fieldLeft, 0])}]},
      right: {transform: [{translateX: interpolate([0, 1], [sourceLeft + fieldHeight - fieldRight, 0])}]},
      middle: {transform: [{translateX: interpolate([0, 1], [sourceCenter - (fieldLeft + fieldWidth / 2), 0])}, {scaleX: progress}]},
      text: {opacity: interpolate([0, .35, 1], [0, 0, 1]), transform: [{translateX: interpolate([0, 1], [sourceLeft - fieldLeft, 0])}]},
      back: {opacity: interpolate([0, .3, 1], [0, .65, 1]), transform: [{translateX: interpolate([0, .3, 1], [sourceCenter - backLeft - buttonSize / 2, (sourceCenter - backLeft - buttonSize / 2) * .42, 0])}]},
    };
  }, [progress, half, radius, sourceLeft, fieldLeft, fieldHeight, fieldRight, sourceCenter, fieldWidth, backLeft, buttonSize]);

  const focusSearch = () => {
    if (!requestFocus.current || !inputReady.current || !latest.current.search.open || !latest.current.active) return;
    const focus = () => {
      focusFrame.current = null;
      if (!requestFocus.current || !latest.current.search.open || !latest.current.active) return;
      requestFocus.current = false;
      input.current?.focus();
    };
    // Android dispatches onLayout before applying the EditText's native frame.
    // Let that frame commit so InputMethodManager accepts the show request.
    if (Platform.OS === 'android') {
      if (focusFrame.current === null) focusFrame.current = requestAnimationFrame(focus);
    } else focus();
  };
  useEffect(() => () => {if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);}, []);
  useLayoutEffect(() => {
    if (previousOpen.current === search.open) return;
    previousOpen.current = search.open;
    let cancelled = false;
    setRetained(true); setSettled(false);
    // Start the keyboard with the expansion, only for a newly opened, visible search.
    // Restoring a saved header or switching back to it must not summon the keyboard.
    requestFocus.current = search.open && latest.current.active;
    if (requestFocus.current) focusSearch();
    else input.current?.blur();
    const finish = () => {
      if (cancelled) return;
      setSettled(true); setRetained(search.open);
      if (!search.open) inputReady.current = Platform.OS !== 'android';
    };
    const animation = Animated.timing(progress, {toValue: search.open ? 1 : 0,
      duration: latest.current.reducedMotion ? 0 : search.open ? 340 : 272,
      easing: Easing.bezier(.2, .75, .25, 1), useNativeDriver: Platform.OS === 'ios' || Platform.OS === 'android', isInteraction: false});
    animation.start(({finished}) => {if (finished) finish();});
    return () => {cancelled = true; animation.stop();};
  }, [search.open, progress]);

  useEffect(() => {if (!active) {requestFocus.current = false; input.current?.blur();}}, [active]);
  useEffect(() => {
    if (Platform.OS !== 'android' || !search.open || !active) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {latest.current.search.onClose(); return true;});
    return () => subscription.remove();
  }, [search.open, active]);

  const visible = search.open || retained;
  return <View ref={boundary} collapsable={false} testID={`ui-${search.scope}-search-header`} onLayout={event => {
    const next = event.nativeEvent.layout.width;
    if (next > 0) setMeasuredWidth(old => Math.abs(old - next) < .5 ? old : next);
  }} style={{height, flexShrink: 0, overflow: 'hidden'}}>
    <Animated.View testID={`ui-${search.scope}-header-normal`} pointerEvents={search.open ? 'none' : 'auto'}
      {...(Platform.OS === 'web' ? {inert: search.open} : {})}
      aria-hidden={search.open} accessibilityElementsHidden={search.open} importantForAccessibility={search.open ? 'no-hide-descendants' : 'auto'}
      style={[StyleSheet.absoluteFill, {zIndex: 2}, motion.normal]}>{children}</Animated.View>
    {visible && <View testID={`ui-${search.scope}-search-surface`} pointerEvents={search.open ? 'box-none' : 'none'}
      aria-hidden={!search.open} accessibilityElementsHidden={!search.open} importantForAccessibility={search.open ? 'auto' : 'no-hide-descendants'} style={StyleSheet.absoluteFill}>
      <View pointerEvents="none" style={{position: 'absolute', top: (height - fieldHeight) / 2, left: fieldLeft, width: fieldWidth, height: fieldHeight}}>
        <Animated.View style={[{position: 'absolute', top: 0, bottom: 0, left: half - 1, width: Math.max(0, fieldWidth - fieldHeight + 2), backgroundColor: colors.surface}, motion.middle]}/>
        <Animated.View style={[{position: 'absolute', top: 0, bottom: 0, left: 0, width: half, backgroundColor: colors.surface,
          borderTopLeftRadius: motion.radius, borderBottomLeftRadius: motion.radius}, motion.left]}/>
        <Animated.View style={[{position: 'absolute', top: 0, bottom: 0, right: 0, width: half, backgroundColor: colors.surface,
          borderTopRightRadius: motion.radius, borderBottomRightRadius: motion.radius}, motion.right]}/>
      </View>
      <Animated.View style={[{position: 'absolute', left: backLeft, top: (height - buttonSize) / 2}, motion.back]}>
        <HoverPressable testID={`ui-${search.scope}-search-back`} accessibilityRole="button" accessibilityLabel="검색 닫기" onPress={search.onClose}
          style={{width: buttonSize, height: buttonSize, borderRadius: 12, alignItems: 'center', justifyContent: 'center'}}>
          <Icon name="back" size={navigationActionMetrics(scale).iconSize}/>
        </HoverPressable>
      </Animated.View>
      <View style={{position: 'absolute', top: (height - fieldHeight) / 2, left: fieldLeft, width: fieldWidth, height: fieldHeight, overflow: 'hidden', borderRadius: radius}}>
      <Animated.View style={[{width: fieldWidth, height: fieldHeight}, motion.text]}>
        <SearchField scope={search.scope} query={search.query} onQueryChange={search.onQueryChange} onClose={search.onClose}
          inputRef={input} editable={search.open && active} showOutline={settled}
          onLayout={() => {inputReady.current = true; focusSearch();}}
          {...(search.onFocus ? {onFocus: search.onFocus} : {})} {...(search.onBlur ? {onBlur: search.onBlur} : {})}/>
      </Animated.View>
      </View>
    </View>}
  </View>;
}
