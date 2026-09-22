import {useEffect, useMemo, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';
import {panelReference, useSettingsScale} from './SettingsLayout';

/** The surrounding settings row owns the switch's input and accessibility. */
export function SettingsToggleIndicator({value}: {value: boolean}) {
  const {settings: p} = useAppearance();
  const scale = useSettingsScale();
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    const update = (enabled: boolean) => {
      if (mounted) setReducedMotion(enabled);
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(update);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => {mounted = false; subscription.remove();};
  }, []);

  useEffect(() => {
    // Retarget from the current position, including during rapid repeated taps.
    progress.stopAnimation();
    if (reducedMotion) {
      progress.setValue(value ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 280,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion, value]);

  const geometry = panelReference.toggle;
  const width = geometry.width * scale;
  const height = geometry.height * scale;
  const inset = geometry.inset * scale;
  const thumb = height - 2 * inset;
  const translateX = useMemo(() => progress.interpolate({
    inputRange: [0, 1], outputRange: [0, width - height],
  }), [height, progress, width]);

  return <View
    pointerEvents="none"
    accessible={false}
    aria-hidden
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    style={{width, height, flexShrink: 0, borderRadius: height / 2, backgroundColor: p.divider}}>
    <Animated.View style={[StyleSheet.absoluteFill, {
      borderRadius: height / 2, backgroundColor: p.primary, opacity: progress,
    }]}/>
    <Animated.View style={{
      position: 'absolute', top: inset, left: inset,
      width: thumb, height: thumb, borderRadius: thumb / 2,
      backgroundColor: p.surface, transform: [{translateX}],
    }}>
      <Animated.View style={[StyleSheet.absoluteFill, {
        borderRadius: thumb / 2, backgroundColor: p.onPrimary, opacity: progress,
      }]}/>
    </Animated.View>
  </View>;
}
