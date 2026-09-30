import {Animated} from 'react-native';

/** Every node runs with the native scroll event; JS only observes it for settling. */
export function createScrollHeaderAnimation(height: number, range = 0) {
  const scrollY = new Animated.Value(0);
  const maxOffset = new Animated.Value(range);
  const settleOffset = new Animated.Value(0);
  const positive = {inputRange: [0, 1], outputRange: [0, 1],
    extrapolateLeft: 'clamp' as const, extrapolateRight: 'extend' as const};
  const nonnegative = scrollY.interpolate(positive);
  const overflow = Animated.subtract(nonnegative, maxOffset).interpolate(positive);
  // Clamp *before* accumulating deltas, so elastic rebounds cannot reveal the header.
  const boundedScroll = Animated.subtract(nonnegative, overflow);
  const collapsed = Animated.diffClamp(Animated.add(boundedScroll, settleOffset), 0, height);
  const scrollable = Animated.subtract(maxOffset, height).interpolate({
    inputRange: [0, 0.001], outputRange: [0, 1], extrapolate: 'clamp',
  });
  const hidden = Animated.multiply(collapsed, scrollable);
  return {scrollY, maxOffset, settleOffset, hidden, translateY: Animated.multiply(hidden, -1)};
}
