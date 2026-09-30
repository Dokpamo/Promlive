import {Image, View, type ImageSourcePropType} from 'react-native';
import {tabIconSources} from './icons/sources';
import {colors} from './tokens';

type TabIconName = keyof typeof tabIconSources;
type Layers = {outline: ImageSourcePropType; fill: ImageSourcePropType; details?: ImageSourcePropType};

/** Keep images mounted and update every layer in the same render as tab selection. */
export function TabIcon({name, selected, size}: {name: TabIconName; selected: boolean; size: number}) {
  const tintColor = selected ? colors.foreground : colors.secondaryForeground;
  const layers: Layers = tabIconSources[name];
  const style = {position: 'absolute' as const, width: size, height: size};
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{width: size, height: size}}>
    <Image accessible={false} source={layers.fill} tintColor={tintColor} resizeMode="contain" fadeDuration={0} style={[style, {opacity: selected ? 1 : 0}]}/>
    <Image accessible={false} source={layers.outline} tintColor={tintColor} resizeMode="contain" fadeDuration={0} style={style}/>
    {layers.details && <Image accessible={false} source={layers.details} tintColor={tintColor} resizeMode="contain" fadeDuration={0} style={[style, {opacity: selected ? 0 : 1}]}/>}
  </View>;
}
