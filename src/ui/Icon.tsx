import {Image, PixelRatio, Platform, View} from 'react-native';
import {navigationIconSizes, navigationIconSources} from './icons/sources';
import {colors, navigation} from './tokens';

export type IconName = keyof typeof navigationIconSources;

export function Icon({name, size}: {name: IconName; size: number}) {
  const drawing = navigationIconSizes[name];
  const scale = size / navigation.iconSize;
  const tight = drawing.width < navigation.iconSize || drawing.height < navigation.iconSize;
  const androidRaster = tight && Platform.OS === 'android';
  const density = PixelRatio.get();
  // Fresco's sampling can soften the outer pixel of a cropped mask. The measured
  // per-axis allowance is in physical pixels, not dp or reference-image pixels.
  const extent = (value: number, extraPixels: number) => androidRaster
    ? (Math.ceil(value * density) + extraPixels) / density
    : value;
  const baseline = androidRaster ? 1 / density : 0;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
    <Image accessible={false} source={navigationIconSources[name]} resizeMode="contain" fadeDuration={0} tintColor={colors.foreground}
      style={{width: extent(drawing.width * scale, drawing.androidExtraWidth), height: extent(drawing.height * scale, drawing.androidExtraHeight),
        transform: [{translateY: baseline}]}}/>
  </View>;
}
