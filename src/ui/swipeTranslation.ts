import {Animated} from 'react-native';

/** Change allowed directions without disconnecting the native page transforms. */
export function createSwipeTranslation(source: Animated.Value, width: number, previous: boolean, next: boolean) {
  const previousWeight = new Animated.Value(previous ? 1 : 0);
  const nextWeight = new Animated.Value(next ? 1 : 0);
  const extent = Math.max(0, width);
  const positive = source.interpolate({inputRange: [0, Math.max(1, extent)], outputRange: [0, extent], extrapolate: 'clamp'});
  const negative = source.interpolate({inputRange: [-Math.max(1, extent), 0], outputRange: [-extent, 0], extrapolate: 'clamp'});
  const translateX = Animated.add(Animated.multiply(positive, previousWeight), Animated.multiply(negative, nextWeight));
  return {translateX, setDirections(previous: boolean, next: boolean) {
    previousWeight.setValue(previous ? 1 : 0);
    nextWeight.setValue(next ? 1 : 0);
  }};
}
