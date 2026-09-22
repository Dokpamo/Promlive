import {View} from 'react-native';
import {useAppearance} from '../features/appearance/AppAppearance';
import type {FrostedEdgeProps} from './FrostedEdge';

/** The native blur backend supports Android/iOS; retain a soft fade on desktop. */
export function FrostedEdge({edge, style, children, testID}: FrostedEdgeProps) {
  const {colors} = useAppearance();
  return <View testID={testID} pointerEvents={children ? 'box-none' : 'none'} style={style}>
    {Array.from({length: 24}, (_, index) => <View key={index} pointerEvents="none" style={{
      position: 'absolute', left: 0, right: 0, top: `${index / 24 * 100}%`, height: `${100 / 24 + 0.1}%`,
      backgroundColor: colors.background, opacity: Math.pow(edge === 'top' ? 1 - index / 24 : (index + 1) / 24, 1.5) * 0.8,
    }}/>)}
    {children}
  </View>;
}
