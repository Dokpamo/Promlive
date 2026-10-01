import {useEffect, useMemo, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View} from 'react-native';
import {useTheme} from '../Theme';

/** Settings update on press; only the thumb and its colors animate. */
export function ToggleIndicator({value}: {value: boolean}) {
  const {colors, appearance} = useTheme();
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    const update = (next: boolean) => {if (mounted) setReducedMotion(next);};
    void AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => update(false));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => {mounted = false; subscription?.remove();};
  }, []);
  useEffect(() => {
    // A second tap reverses from the current position without resetting it.
    progress.stopAnimation();
    if (reducedMotion !== false) {
      progress.setValue(value ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: value ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web', isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion, value]);
  const translateX = useMemo(() => progress.interpolate({inputRange: [0, 1], outputRange: [0, 20]}), [progress]);
  return <View pointerEvents="none" accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{width: 48, height: 28, flexShrink: 0, borderRadius: 14, backgroundColor: appearance === 'dark' ? '#454545' : '#D9D9D9'}}>
    <Animated.View style={[StyleSheet.absoluteFill, {borderRadius: 14, backgroundColor: colors.selectedBackground, opacity: progress}]}/>
    <Animated.View style={{position: 'absolute', top: 3, left: 3, width: 22, height: 22, borderRadius: 11,
      backgroundColor: '#FFFFFF', transform: [{translateX}]}}>
      <Animated.View style={[StyleSheet.absoluteFill, {borderRadius: 11, backgroundColor: colors.selectedForeground, opacity: progress}]}/>
    </Animated.View>
  </View>;
}
