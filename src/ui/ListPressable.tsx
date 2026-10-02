import {useEffect, useRef, type ReactNode} from 'react';
import {Animated, Easing, Platform, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle} from 'react-native';
import {usePalette} from './Theme';
import {useReducedMotion} from './useReducedMotion';

type Props = Omit<PressableProps, 'children' | 'style'> & {children: ReactNode; style?: StyleProp<ViewStyle>};

/** Only the row background responds; text, icons and the touch target stay still. */
export function ListPressable({children, style, onPressIn, onPressOut, disabled, ...props}: Props) {
  const colors = usePalette();
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => () => opacity.stopAnimation(), [opacity]);
  useEffect(() => {if (disabled) {opacity.stopAnimation(); opacity.setValue(0);}}, [disabled, opacity]);
  return <Pressable {...props} disabled={disabled} style={style}
    onPressIn={event => {opacity.stopAnimation(); opacity.setValue(1); onPressIn?.(event);}}
    onPressOut={event => {
      opacity.stopAnimation();
      if (reduced) opacity.setValue(0);
      else Animated.timing(opacity, {toValue: 0, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web', isInteraction: false}).start();
      onPressOut?.(event);
    }}>
    <Animated.View testID="ui-row-press-background" pointerEvents="none" accessible={false} aria-hidden
      style={[StyleSheet.absoluteFill, {borderRadius: StyleSheet.flatten(style)?.borderRadius ?? 0, backgroundColor: colors.inputSurface, opacity}]}/>
    {children}
  </Pressable>;
}
