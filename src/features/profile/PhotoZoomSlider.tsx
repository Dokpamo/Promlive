import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, Easing, PanResponder, Platform, Text, View, type GestureResponderEvent, type PanResponderGestureState} from 'react-native';
import {maximumPhotoZoom} from './photoCrop';

// SEED Slider dimensions and motion, in native points: https://seed-design.io/components/slider
const thumbSize = 20;
const touchHeight = 44;
const trackHeight = 4;
const easing = Easing.bezier(0.35, 0, 0.35, 1);
const enterEasing = Easing.bezier(0, 0, 0.15, 1);
const nativeDriver = Platform.OS !== 'web';

export function PhotoZoomSlider({value, onChange, disabled}: {
  value: number; onChange: (value: number) => void; disabled: boolean;
}) {
  const [width, setWidth] = useState(0);
  const [indicatorWidth, setIndicatorWidth] = useState(52);
  const [pressed, setPressed] = useState(false);
  const [reduced, setReduced] = useState(false);
  const position = useRef(new Animated.Value(0)).current;
  const thumbScale = useRef(new Animated.Value(1)).current;
  const indicatorOpacity = useRef(new Animated.Value(0)).current;
  const indicatorScale = useRef(new Animated.Value(0.9)).current;
  const animateNext = useRef(false);
  const drag = useRef<{position: number; track: number} | null>(null);
  const latest = useRef({value, onChange, disabled});
  latest.current = {value, onChange, disabled};
  const inset = thumbSize / 2;
  const track = Math.max(0, width - thumbSize);
  const progress = Math.max(0, Math.min(1, (value - 1) / (maximumPhotoZoom - 1)));

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(next => {if (mounted) setReduced(next);});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {mounted = false; subscription.remove();};
  }, []);

  useLayoutEffect(() => {
    position.stopAnimation();
    const target = progress * track;
    if (animateNext.current && !reduced) {
      Animated.timing(position, {toValue: target, duration: 150, easing, useNativeDriver: nativeDriver}).start();
    } else position.setValue(target);
    animateNext.current = false;
    return () => position.stopAnimation();
  }, [position, progress, track, reduced]);

  useEffect(() => {
    const active = pressed && !disabled;
    thumbScale.stopAnimation(); indicatorOpacity.stopAnimation(); indicatorScale.stopAnimation();
    if (reduced) {
      thumbScale.setValue(active ? 1.2 : 1);
      indicatorOpacity.setValue(active ? 1 : 0); indicatorScale.setValue(1);
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(thumbScale, {toValue: active ? 1.2 : 1, duration: 150, easing, useNativeDriver: nativeDriver}),
      Animated.timing(indicatorOpacity, {toValue: active ? 1 : 0, duration: 200, easing: active ? enterEasing : easing, useNativeDriver: nativeDriver}),
      Animated.timing(indicatorScale, {toValue: 1, duration: 200, easing: enterEasing, useNativeDriver: nativeDriver}),
    ]);
    animation.start(({finished}) => {if (finished && !active) indicatorScale.setValue(0.9);});
    return () => animation.stop();
  }, [pressed, disabled, reduced, thumbScale, indicatorOpacity, indicatorScale]);

  const change = (next: number, animate = false) => {
    if (latest.current.disabled) return;
    const bounded = Math.max(1, Math.min(maximumPhotoZoom, next));
    if (bounded === latest.current.value) return;
    animateNext.current = animate;
    latest.current.onChange(bounded);
  };
  const pan = useMemo(() => {
    const move = (_event: GestureResponderEvent, gesture: PanResponderGestureState) => {
      const start = drag.current;
      // Android locationX changes its origin outside the view; accumulated travel stays stable.
      if (start && start.track > 0) change(1 + (start.position + gesture.dx) / start.track * (maximumPhotoZoom - 1));
    };
    const release = () => {drag.current = null; setPressed(false);};
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !latest.current.disabled,
      onMoveShouldSetPanResponder: () => !latest.current.disabled,
      onPanResponderGrant: event => {
        if (latest.current.disabled) return;
        setPressed(true);
        const x = event.nativeEvent.locationX;
        const center = inset + (latest.current.value - 1) / (maximumPhotoZoom - 1) * track;
        // Grabbing the thumb off-center must not change the chosen zoom on touch-down.
        const grabbingThumb = Math.abs(x - center) <= touchHeight / 2;
        const start = Math.max(0, Math.min(track, (grabbingThumb ? center : x) - inset));
        drag.current = {position: start, track};
        if (!grabbingThumb && track > 0) change(1 + start / track * (maximumPhotoZoom - 1), true);
      },
      onPanResponderMove: move,
      onPanResponderRelease: release,
      onPanResponderTerminate: release,
      onPanResponderTerminationRequest: () => false,
    });
  }, [inset, track]);

  const center = Animated.add(position, inset);
  const bubbleWidth = Math.min(indicatorWidth, width || indicatorWidth);
  const bubbleLeft = center.interpolate({
    inputRange: [bubbleWidth / 2, Math.max(bubbleWidth / 2 + 0.01, width - bubbleWidth / 2)],
    outputRange: [0, Math.max(0, width - bubbleWidth)], extrapolate: 'clamp',
  });

  return <View testID="profile-photo-zoom" accessible accessibilityRole="adjustable" accessibilityLabel="사진 확대 비율"
    accessibilityValue={{min: 100, max: maximumPhotoZoom * 100, now: Math.round(value * 100), text: `${Math.round(value * 100)}%`}}
    accessibilityState={{disabled}} accessibilityActions={[{name: 'increment'}, {name: 'decrement'}]}
    onAccessibilityAction={event => {
      if (event.nativeEvent.actionName === 'increment') change(latest.current.value + 0.1, true);
      if (event.nativeEvent.actionName === 'decrement') change(latest.current.value - 0.1, true);
    }}
    onLayout={event => setWidth(event.nativeEvent.layout.width)}
    style={{flex: 1, height: touchHeight, justifyContent: 'center', opacity: disabled ? 0.4 : 1}}
    {...pan.panHandlers}>
    <View pointerEvents="none" style={{position: 'absolute', left: inset, right: inset, height: trackHeight, borderRadius: trackHeight / 2, backgroundColor: '#393D46'}}/>
    <Animated.View pointerEvents="none" style={{position: 'absolute', left: inset, width: track, height: trackHeight, borderRadius: trackHeight / 2, backgroundColor: '#FFFFFF', transform: [{translateX: Animated.divide(Animated.subtract(position, track), 2)}, {scaleX: Animated.divide(position, track || 1)}]}}/>
    <Animated.View testID="profile-photo-zoom-thumb" pointerEvents="none" style={{position: 'absolute', left: 0, width: thumbSize, height: thumbSize, borderRadius: inset, backgroundColor: '#FFFFFF', transform: [{translateX: position}, {scale: thumbScale}]}}/>
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{position: 'absolute', left: 0, bottom: touchHeight / 2 + thumbSize * 1.2 / 2 + 2 + 6, transform: [{translateX: bubbleLeft}]}}>
      <Animated.View testID="profile-photo-zoom-indicator" style={{opacity: indicatorOpacity, transform: [{scale: indicatorScale}]}}>
        <View onLayout={event => setIndicatorWidth(event.nativeEvent.layout.width)} style={{minWidth: 24, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#FFFFFF'}}>
          <Text style={{fontSize: 13, lineHeight: 18, fontWeight: '500', includeFontPadding: false, color: '#111111', fontVariant: ['tabular-nums']}}>{Math.round(value * 100)}%</Text>
        </View>
        <Animated.View style={{position: 'absolute', top: '100%', left: 0, width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FFFFFF', transform: [{translateX: Animated.subtract(Animated.subtract(center, bubbleLeft), 4)}]}}/>
      </Animated.View>
    </Animated.View>
  </View>;
}
