import {Animated} from 'react-native';

/** A native graph splits one gesture into either page travel or body-only travel. */
export function createRootSwipeAnimation(translation: Animated.AnimatedInterpolation<number>, width: number,
  previousIsTab: boolean, nextIsTab: boolean) {
  const previousTab = new Animated.Value(previousIsTab ? 1 : 0);
  const nextTab = new Animated.Value(nextIsTab ? 1 : 0);
  const positive = translation.interpolate({inputRange: [0, Math.max(1, width)], outputRange: [0, width], extrapolate: 'clamp'});
  const negative = translation.interpolate({inputRange: [-Math.max(1, width), 0], outputRange: [-width, 0], extrapolate: 'clamp'});
  const pageX = Animated.add(Animated.multiply(positive, previousTab), Animated.multiply(negative, nextTab));
  const bodyX = Animated.subtract(translation, pageX);
  return {pageX, bodyX, setTabDirections(previous: boolean, next: boolean) {
    previousTab.setValue(previous ? 1 : 0); nextTab.setValue(next ? 1 : 0);
  }};
}
