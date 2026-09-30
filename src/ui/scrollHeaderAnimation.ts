import {Animated} from 'react-native';

/** Native events drive the transform; observers maintain release decisions and render snapshots. */
export function createScrollHeaderAnimation(height: number, range = 0) {
  const scrollY = new Animated.Value(0);
  const maxOffset = new Animated.Value(range);
  const positive = {inputRange: [0, 1], outputRange: [0, 1],
    extrapolateLeft: 'clamp' as const, extrapolateRight: 'extend' as const};
  const nonnegative = scrollY.interpolate(positive);
  const overflow = Animated.subtract(nonnegative, maxOffset).interpolate(positive);
  // Clamp *before* accumulating deltas, so elastic rebounds cannot reveal the header.
  const boundedScroll = Animated.subtract(nonnegative, overflow);
  const collapsed = Animated.diffClamp(boundedScroll, 0, height);
  const scrollable = Animated.subtract(maxOffset, height).interpolate({
    inputRange: [0, 0.001], outputRange: [0, 1], extrapolate: 'clamp',
  });
  const hidden = Animated.multiply(collapsed, scrollable);
  const observeInputs = (onScroll: (value: number) => void) => {
    // RN 0.81's native diffClamp and its JS render snapshot accumulate separately.
    // Fabric reads the JS graph when scrolling/animation ends. Consume every input
    // there too: reading only the final offset loses reversals past either clamp.
    // This read never writes a native value or drives the visual transform from JS.
    const syncSnapshot = () => (hidden as unknown as {__getValue: () => number}).__getValue();
    const scrollListener = scrollY.addListener(({value}) => {syncSnapshot(); onScroll(value);});
    const rangeListener = maxOffset.addListener(syncSnapshot);
    return () => {
      scrollY.removeListener(scrollListener);
      maxOffset.removeListener(rangeListener);
    };
  };
  return {scrollY, maxOffset, hidden, translateY: Animated.multiply(hidden, -1), observeInputs};
}
