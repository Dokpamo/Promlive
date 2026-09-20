import type {ReactNode} from 'react';
import {Animated, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle} from 'react-native';
import {usePressFeedback} from '../../layout/usePressFeedback';
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
  const {progress, onPressIn, onPressOut} = usePressFeedback();

  return <Pressable {...props} style={style} onPressIn={onPressIn} onPressOut={onPressOut}>
    <Animated.View testID="settings-press-surface" style={[contentStyle, {transform: [{scale: progress.interpolate({inputRange: [0, 1], outputRange: [1, 0.98]})}]}]}>
      <Animated.View testID="settings-press-highlight" pointerEvents="none" style={[StyleSheet.absoluteFill, {left: highlightInset, right: highlightInset, borderRadius: radius, backgroundColor: p.selected, opacity: selected ? 1 : progress}]}/>
      {children}
    </Animated.View>
  </Pressable>;
}
