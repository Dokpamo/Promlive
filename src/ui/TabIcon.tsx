import {useMemo} from 'react';
import {Animated, PixelRatio, View} from 'react-native';
import {usePalette} from './Theme';
import {navigationIconSources} from './icons/sources';
import type {Tab} from './navigationRoutes';
import {releaseWaveFrame, waveSamples} from './tabReleaseWave';

type Scalar = Animated.AnimatedInterpolation<number> | Animated.Value | Animated.AnimatedAddition<number>;
const sum = (values: Scalar[], initial = 0): Scalar => values.reduce<Scalar>((total, value) => Animated.add(total, value), new Animated.Value(initial));

/** Approved icon masks, with a small travelling wave entirely on the UI thread. */
export function TabIcon({name, selection, waves, size}: {name: Tab; selection: Animated.Value; waves: Animated.Value[]; size: number}) {
  const colors = usePalette();
  const unselected = useMemo(() => Animated.subtract(1, selection), [selection]);
  const motion = useMemo(() => {
    const interpolate = (fn: (t: number) => number, initial = 0) => sum(waves.map(wave => wave.interpolate({
      inputRange: waveSamples, outputRange: waveSamples.map(fn), extrapolate: 'clamp',
    })), initial);
    const density = PixelRatio.get(), pixels = Math.round(size * density);
    return {
      scaleX: interpolate(t => releaseWaveFrame(t).scaleX - 1, 1),
      scaleY: interpolate(t => releaseWaveFrame(t).scaleY - 1, 1),
      strips: Array.from({length: 4}, (_, i) => {
        const left = Math.round(pixels * i / 4) / density, right = Math.round(pixels * (i + 1) / 4) / density;
        const center = (left + right) / 2, x = center / size * 2 - 1;
        return {left, width: right - left, center,
          offset: interpolate(t => releaseWaveFrame(t, x).offset * size / 2),
          shear: interpolate(t => releaseWaveFrame(t, x).shear).interpolate({inputRange: [-1, 1], outputRange: ['-1rad', '1rad']}),
        };
      }),
    };
  }, [waves, size]);
  const image = {position: 'absolute' as const, width: size, height: size};
  return <Animated.View testID={`ui-tab-motion-${name}`} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none"
    style={{width: size, height: size, transform: [{scaleX: motion.scaleX}, {scaleY: motion.scaleY}]}}>
    {motion.strips.map((strip, index) => <View key={index} style={{position: 'absolute', left: strip.left, top: -size / 4,
      width: strip.width, height: size * 1.5, overflow: 'hidden'}}>
      <Animated.View style={{position: 'absolute', left: -strip.left, top: size / 4, width: size, height: size,
        transformOrigin: [strip.center, size / 2, 0], transform: [{translateY: strip.offset}, {skewY: strip.shear}]}}>
        <Animated.Image accessible={false} source={navigationIconSources[name]} tintColor={colors.secondaryForeground} resizeMode="contain" fadeDuration={0} style={[image, {opacity: unselected}]}/>
        <Animated.Image accessible={false} source={navigationIconSources[`${name}Selected`]} tintColor={colors.foreground} resizeMode="contain" fadeDuration={0} style={[image, {opacity: selection}]}/>
      </Animated.View>
    </View>)}
  </Animated.View>;
}
