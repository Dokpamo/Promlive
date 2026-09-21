import {useEffect, useRef} from 'react';
import {AccessibilityInfo, Animated, Easing, Platform} from 'react-native';

export const pressedScale = 0.98;
// Small circular controls need more travel than a full-width settings row.
export const iconPressedScale = 0.94;
const minimumPressDuration = 120;

/** Shared press timing, including cancellation and the system's reduced-motion preference. */
export function usePressFeedback() {
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useRef(false);
  const pressed = useRef(false);
  const pressedAt = useRef(0);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelRelease = () => {
    if (releaseTimer.current !== null) clearTimeout(releaseTimer.current);
    releaseTimer.current = null;
  };

  useEffect(() => {
    let mounted = true;
    const update = (value: boolean) => {
      if (!mounted) return;
      reduced.current = value;
      if (value) {
        cancelRelease();
        progress.stopAnimation();
        progress.setValue(pressed.current ? 1 : 0);
      }
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(update);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => {mounted = false; cancelRelease(); subscription.remove(); progress.stopAnimation();};
  }, [progress]);

  const animate = (down: boolean) => {
    progress.stopAnimation();
    if (reduced.current) {
      progress.setValue(down ? 1 : 0);
      return;
    }
    Animated.timing(progress, {
      toValue: down ? 1 : 0,
      duration: down ? 90 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const press = (down: boolean) => {
    pressed.current = down;
    cancelRelease();
    if (down) {
      pressedAt.current = Date.now();
      animate(true);
      return;
    }
    // A quick tap can emit press-in/out in the same frame on web. Let the
    // visual press finish before releasing, without delaying the action.
    const remaining = minimumPressDuration - (Date.now() - pressedAt.current);
    if (!reduced.current && remaining > 0) {
      releaseTimer.current = setTimeout(() => {releaseTimer.current = null; animate(false);}, remaining);
    } else {
      animate(false);
    }
  };

  return {progress, onPressIn: () => press(true), onPressOut: () => press(false)};
}
