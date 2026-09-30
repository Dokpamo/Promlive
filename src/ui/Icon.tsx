import {Image, View} from 'react-native';
import {navigationIconSources} from './icons/sources';
import {colors} from './tokens';

export type IconName = keyof typeof navigationIconSources;

export function Icon({name, size, tone = 'primary'}: {name: IconName; size: number; tone?: 'primary' | 'secondary'}) {
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
    <Image accessible={false} source={navigationIconSources[name]} resizeMode="contain" fadeDuration={0}
      tintColor={tone === 'secondary' ? colors.secondaryForeground : colors.foreground}
      style={{width: size, height: size}}/>
  </View>;
}
