import type {ReactNode} from 'react';
import {ProgressiveBlurView} from '@sbaiahmed1/react-native-blur';
import type {StyleProp, ViewStyle} from 'react-native';
import {useAppearance} from '../features/appearance/AppAppearance';

export interface FrostedEdgeProps {
  edge: 'top' | 'bottom';
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  testID?: string;
}

/** Keep controls sharp while the scrolling backdrop fades toward a screen edge. */
export function FrostedEdge({edge, style, children, testID}: FrostedEdgeProps) {
  const {isDark, colors} = useAppearance();
  return <ProgressiveBlurView testID={testID} pointerEvents={children ? 'box-none' : 'none'}
    blurType={isDark ? 'dark' : 'xlight'} blurAmount={24} blurRounds={2}
    direction={edge === 'top' ? 'blurredTopClearBottom' : 'blurredBottomClearTop'}
    startOffset={0.35} reducedTransparencyFallbackColor={colors.background}
    style={style}>{children}</ProgressiveBlurView>;
}
