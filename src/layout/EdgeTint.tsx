import type {ReactNode} from 'react';
import {Platform, StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import {useAppearance} from '../features/appearance/AppAppearance';

const stops = [
  {position: 0, opacity: 0.68},
  {position: 0.32, opacity: 0.52},
  {position: 0.7, opacity: 0.18},
  {position: 1, opacity: 0},
] as const;

/** A translucent wash of the page's own color; scrolling content stays sharp. */
export function EdgeTint({edge, style, children, testID, surfaceColor}: {
  edge: 'top' | 'bottom';
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  testID?: string;
  /** A six-digit hex color from the page palette. */
  surfaceColor?: string;
}) {
  const {colors} = useAppearance();
  const color = surfaceColor ?? colors.background;
  const gradient = `linear-gradient(to ${edge === 'top' ? 'bottom' : 'top'}, ${stops.map(stop =>
    `${color}${Math.round(stop.opacity * 255).toString(16).padStart(2, '0')} ${stop.position * 100}%`).join(', ')})`;
  const nativeDesktop = Platform.OS === 'macos' || Platform.OS === 'windows';
  const gradientStyle: ViewStyle & {backgroundImage?: string} = Platform.OS === 'web'
    ? {backgroundImage: gradient}
    : {experimental_backgroundImage: gradient};
  return <View testID={testID} pointerEvents={children ? 'box-none' : 'none'} style={style}>
    {nativeDesktop ? Array.from({length: 32}, (_, index) => {
      const position = edge === 'top' ? index / 31 : 1 - index / 31;
      const end = stops.findIndex(stop => stop.position >= position);
      const to = stops[Math.max(1, end)]!;
      const from = stops[Math.max(0, end - 1)]!;
      const opacity = from.opacity + (to.opacity - from.opacity) * (position - from.position) / (to.position - from.position);
      return <View key={index} pointerEvents="none" style={{position: 'absolute', left: 0, right: 0,
        top: `${index / 32 * 100}%`, height: `${100 / 32}%`, backgroundColor: color, opacity}}/>;
    }) : <View pointerEvents="none" style={[StyleSheet.absoluteFill, gradientStyle]}/>}
    {children}
  </View>;
}
