import {Animated, Platform} from 'react-native';
import type {ScreenCorners} from './screenCorners';

/** Both pages share the same native gesture value, including reversal and cancellation. */
export function createBackTransition(translation: Animated.Value, width: number, corners: ScreenCorners) {
  let opening = false;
  const progress = translation.interpolate({inputRange: [0, Math.max(1, width)], outputRange: [0, 1], extrapolate: 'clamp'});
  const radius = (value: number) => progress.interpolate({inputRange: [0, 0.12, 1], outputRange: [0, value, value], extrapolate: 'clamp'});
  return {
    translation,
    // Prepare before mounting so the first painted frame is already offscreen.
    prepareOpen() {opening = true; translation.stopAnimation(); translation.setValue(width);},
    isOpening() {return opening;},
    arrive() {opening = false; translation.setValue(0);},
    // Native gestures can finish without synchronising the JS value. Commit the
    // endpoint before removing the foreground so Fabric cannot restore an old tint/offset.
    finish() {opening = false; translation.stopAnimation(); translation.setValue(width);},
    // The previous page follows from the left at 30% speed, at its full size throughout.
    underlayX: progress.interpolate({inputRange: [0, 1], outputRange: [-width * 0.3, 0]}),
    // Tint the surface, never fade its content out. Both return exactly to zero on arrival.
    dimOpacity: progress.interpolate({inputRange: [0, 1], outputRange: [0.12, 0]}),
    shadowOpacity: progress.interpolate({inputRange: [0, 0.04, 0.85, 1], outputRange: [0, 1, 1, 0]}),
    corners: {
      borderTopLeftRadius: radius(corners.topLeft), borderTopRightRadius: radius(corners.topRight),
      borderBottomLeftRadius: radius(corners.bottomLeft), borderBottomRightRadius: radius(corners.bottomRight),
    },
  };
}

/** The same settling motion in either direction, without overshooting the page. */
export function pageSpring(translation: Animated.Value, destination: number, width: number, velocity = 0) {
  return Animated.spring(translation, {toValue: destination, velocity: Math.max(-width * 4, Math.min(width * 4, velocity)),
    stiffness: 500, damping: 45, mass: 1, overshootClamping: true,
    restDisplacementThreshold: 0.5, restSpeedThreshold: 5,
    useNativeDriver: Platform.OS === 'android' || Platform.OS === 'ios'});
}

export type BackTransition = ReturnType<typeof createBackTransition>;

export type BackUnderlaySource = 0 | 1 | null;

/** Keep both native inputs attached for the lifetime of a screen. Switching an
 * Animated props graph while revealing it can leave its old native transform/tint. */
export function createBackUnderlay(primary: BackTransition | undefined, secondary: BackTransition | undefined,
  source: BackUnderlaySource) {
  const primaryWeight = new Animated.Value(source === 0 ? 1 : 0);
  const secondaryWeight = new Animated.Value(source === 1 ? 1 : 0);
  return {
    translateX: Animated.add(Animated.multiply(primary?.underlayX ?? 0, primaryWeight),
      Animated.multiply(secondary?.underlayX ?? 0, secondaryWeight)),
    dimOpacity: Animated.add(Animated.multiply(primary?.dimOpacity ?? 0, primaryWeight),
      Animated.multiply(secondary?.dimOpacity ?? 0, secondaryWeight)),
    select(next: BackUnderlaySource) {
      primaryWeight.setValue(next === 0 ? 1 : 0);
      secondaryWeight.setValue(next === 1 ? 1 : 0);
    },
  };
}
