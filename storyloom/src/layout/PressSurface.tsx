import type {ReactNode} from 'react';
import {Animated, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle} from 'react-native';
import {iconPressedScale, pressedScale, usePressFeedback} from './usePressFeedback';

type Props = Omit<PressableProps, 'children' | 'style' | 'onPressIn' | 'onPressOut'> & {
  children: ReactNode;
  radius: number;
  highlightColor: string;
  highlightOpacity?: number;
  highlightInset?: number;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  surfaceTestID?: string;
  highlightTestID?: string;
};

/** Shrink the complete button surface; its layout and touch target stay fixed. */
export function PressSurface({children, radius, highlightColor, highlightOpacity = 1, highlightInset = 0, compact = false, style, contentStyle, surfaceTestID, highlightTestID, disabled = false, ...props}: Props) {
  const {progress, onPressIn, onPressOut} = usePressFeedback();
  return <Pressable {...props} disabled={disabled} onPressIn={onPressIn} onPressOut={onPressOut} style={style}>
    <Animated.View testID={surfaceTestID} style={[{flex: 1, borderRadius: radius}, contentStyle, {opacity: disabled ? 0.4 : 1, transform: [{scale: progress.interpolate({inputRange: [0, 1], outputRange: [1, compact ? iconPressedScale : pressedScale]})}]}]}>
      <Animated.View testID={highlightTestID} pointerEvents="none" style={[StyleSheet.absoluteFill, {top: highlightInset, right: highlightInset, bottom: highlightInset, left: highlightInset, borderRadius: Math.max(0, radius - highlightInset), backgroundColor: highlightColor, opacity: Animated.multiply(progress, highlightOpacity)}]}/>
      {children}
    </Animated.View>
  </Pressable>;
}
