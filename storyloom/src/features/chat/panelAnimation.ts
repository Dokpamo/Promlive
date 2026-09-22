import type {Animated} from 'react-native';

export const panelSpring = {
  stiffness: 260, damping: 32, mass: 1, overshootClamping: true,
  restDisplacementThreshold: 0.001, restSpeedThreshold: 0.001,
} as const;

/** Finish within half a screen point, for both pixel and normalized animations. */
export function panelSpringForDistance(pointsPerUnit = 1) {
  const scale = Math.max(1, pointsPerUnit);
  return {...panelSpring, restDisplacementThreshold: 0.5 / scale, restSpeedThreshold: 8 / scale};
}

/** Native animations can be ahead of JS listeners. Read all stopped axes before grabbing. */
export function stopAndRead(values: readonly Animated.Value[], done: (positions: number[]) => void) {
  const positions: number[] = [];
  let remaining = values.length;
  values.forEach((value, index) => value.stopAnimation(position => {
    positions[index] = position;
    if (--remaining === 0) done(positions);
  }));
}
