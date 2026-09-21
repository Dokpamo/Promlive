import type {ReactNode} from 'react';
import {Animated, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle} from 'react-native';
import {pressedScale, usePressFeedback} from '../../layout/usePressFeedback';
import {useAppearance} from '../appearance/AppAppearance';

export const rowPressedScale = pressedScale;

type Props = Omit<PressableProps, 'children' | 'style' | 'onPressIn' | 'onPressOut'> & {
  children: ReactNode;
  radius: number;
  selected?: boolean;
  selectedHighlight?: 'full' | 'pressed';
  highlightInset?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Animate the visual surface without moving the row's layout or touch target. */
export function SettingsPressable({children, radius, selected = false, selectedHighlight = 'full', highlightInset = 0, style, contentStyle, ...props}: Props) {
  const {settings: p} = useAppearance();
  const {progress, onPressIn, onPressOut} = usePressFeedback();
  const pressScale = progress.interpolate({inputRange: [0, 1], outputRange: [1, rowPressedScale]});

  return <Pressable {...props} style={style} onPressIn={onPressIn} onPressOut={onPressOut}>
    {/* A selected background can keep its pressed shape without shrinking twice. */}
    <Animated.View testID="settings-press-highlight" pointerEvents="none" style={[StyleSheet.absoluteFill, {left: highlightInset, right: highlightInset, borderRadius: radius, backgroundColor: p.selected, opacity: selected ? 1 : progress, transform: [{scale: selected && selectedHighlight === 'pressed' ? rowPressedScale : pressScale}]}]}/>
    <Animated.View testID="settings-press-surface" style={[contentStyle, {transform: [{scale: pressScale}]}]}>
      {children}
    </Animated.View>
  </Pressable>;
}
