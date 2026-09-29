import {Image, View} from 'react-native';
import {navigationIconSources} from './navigationIconSources';

export type NavigationIconName = keyof typeof navigationIconSources;

/** Only the navigation uses these paths; existing editor icons remain independent. */
export function NavigationIcon({name, size, color}: {name: NavigationIconName; size: number; color: string}) {
  return <View accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{width: size, height: size}}>
    <Image accessible={false} source={navigationIconSources[name]} resizeMode="contain" fadeDuration={0} tintColor={color} style={{width: size, height: size}}/>
  </View>;
}
