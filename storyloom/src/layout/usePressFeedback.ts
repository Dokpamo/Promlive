import {useEffect, useRef} from 'react';
import {AccessibilityInfo, Animated, Easing, Platform} from 'react-native';

/** Shared press timing, including cancellation and the system's reduced-motion preference. */
export function usePressFeedback() {
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useRef(false);
  const pressed = useRef(false);

  useEffect(() => {
    let mounted = true;
    const update = (value: boolean) => {
      if (!mounted) return;
      reduced.current = value;
      if (value) {
        progress.stopAnimation();
        progress.setValue(pressed.current ? 1 : 0);
      }
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(update);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => {mounted = false; subscription.remove(); progress.stopAnimation();};
  }, [progress]);

  const press = (down: boolean) => {
    pressed.current = down;
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

  return {progress, onPressIn: () => press(true), onPressOut: () => press(false)};
}
