import {useEffect, useRef, type ReactNode} from 'react';
import {AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';

type Props = Omit<PressableProps, 'children' | 'style' | 'onPressIn' | 'onPressOut'> & {
  children: ReactNode;
  radius: number;
  selected?: boolean;
  highlightInset?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Animate the visual surface without moving the row's layout or touch target. */
export function SettingsPressable({children, radius, selected = false, highlightInset = 0, style, contentStyle, ...props}: Props) {
  const {settings: p} = useAppearance();
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useRef(false);
  const pressed = useRef(false);

  useEffect(() => {
    let mounted = true;
    const update = (value: boolean) => {
      if (!mounted) return;
      reduced.current = value;
      if (value) {
        progress.stopAnimation();
        progress.setValue(pressed.current ? 1 : 0);
      }
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(update);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => {mounted = false; subscription.remove(); progress.stopAnimation();};
  }, [progress]);

  const press = (down: boolean) => {
    pressed.current = down;
    progress.stopAnimation();
    if (reduced.current) {
      progress.setValue(down ? 1 : 0);
      return;
    }
    Animated.timing(progress, {
      toValue: down ? 1 : 0,
      duration: down ? 90 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  return <Pressable {...props} style={style} onPressIn={() => press(true)} onPressOut={() => press(false)}>
    <Animated.View testID="settings-press-surface" style={[contentStyle, {transform: [{scale: progress.interpolate({inputRange: [0, 1], outputRange: [1, 0.98]})}]}]}>
      <Animated.View testID="settings-press-highlight" pointerEvents="none" style={[StyleSheet.absoluteFill, {left: highlightInset, right: highlightInset, borderRadius: radius, backgroundColor: p.selected, opacity: selected ? 1 : progress}]}/>
      {children}
    </Animated.View>
  </Pressable>;
}
