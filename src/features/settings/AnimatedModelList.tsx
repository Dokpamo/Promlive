import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, Easing, View} from 'react-native';
import {SettingsChoice, useSettingsScale} from './SettingsLayout';
import type {AiModelPreview} from './aiSettingsModel';

export const catalogArrivalMotion = {scale: 0.965, opacity: 0, offset: -12} as const;

export interface CatalogArrivalTiming {
  shiftDuration: number;
  revealDelay: number;
  revealDuration: number;
}

/** Shared by the live picker and preview: move first, reveal during the final stretch. */
export const catalogArrivalTiming: CatalogArrivalTiming = {shiftDuration: 360, revealDelay: 240, revealDuration: 280};

/** Independent eased phases on one clock let the reveal overlap the shift's tail. */
function phaseProgress(progress: Animated.Value, delay: number, duration: number, total: number, easing: (value: number) => number) {
  const steps = Array.from({length: 31}, (_, index) => index / 30);
  return progress.interpolate({
    inputRange: steps.map(step => (delay + duration * step) / total),
    outputRange: steps.map(easing),
    extrapolate: 'clamp',
  });
}

/** One expanding block moves existing rows continuously; only the arriving block scales/fades. */
export function AnimatedModelList({models, selected, onSelect, timing = catalogArrivalTiming}: {
  models: AiModelPreview[]; selected: string; onSelect: (model: AiModelPreview) => void;
  timing?: CatalogArrivalTiming;
}) {
  const s = useSettingsScale();
  const previous = useRef(models);
  const progress = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [batch, setBatch] = useState({added: [] as AiModelPreview[], rest: models, revision: 0});
  const [measurement, setMeasurement] = useState({revision: -1, height: 0});
  const duration = Math.max(timing.shiftDuration, timing.revealDelay + timing.revealDuration);
  useEffect(() => {
    let alive = true;
    const update = (value: boolean) => {if (alive) setReduceMotion(value);};
    void AccessibilityInfo.isReduceMotionEnabled().then(update);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => {alive = false; listener.remove(); progress.stopAnimation();};
  }, [progress]);
  useLayoutEffect(() => {
    if (previous.current === models) return;
    const ids = new Set(previous.current.map(model => model.id));
    previous.current = models;
    const added = models.filter(model => !ids.has(model.id));
    progress.stopAnimation();
    progress.setValue(added.length && !reduceMotion ? 0 : 1);
    setBatch(old => ({added, rest: models.filter(model => ids.has(model.id)), revision: old.revision + 1}));
  }, [models, progress, reduceMotion]);
  useEffect(() => {
    if (!batch.added.length || measurement.revision !== batch.revision) return;
    if (reduceMotion) {progress.setValue(1); return;}
    const animation = Animated.timing(progress, {
      toValue: 1, duration,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [batch, duration, measurement, progress, reduceMotion]);
  const row = (model: AiModelPreview) => <SettingsChoice key={model.id} label={model.name} detail={model.detail} selected={selected === model.id} onPress={() => onSelect(model)}/>;
  const height = measurement.revision === batch.revision ? measurement.height : 0;
  const shift = phaseProgress(progress, 0, timing.shiftDuration, duration, Easing.bezier(0.22, 1, 0.36, 1));
  const reveal = phaseProgress(progress, timing.revealDelay, timing.revealDuration, duration, Easing.bezier(0.25, 0.1, 0.25, 1));
  return <View testID="model-catalog-list">
    {batch.added.length > 0 && <Animated.View testID="model-catalog-arrivals" style={{height: shift.interpolate({inputRange: [0, 1], outputRange: [0, height]}), overflow: 'hidden', marginHorizontal: -20 * s, paddingHorizontal: 20 * s}}>
      <Animated.View key={batch.revision} onLayout={event => setMeasurement({revision: batch.revision, height: event.nativeEvent.layout.height})} style={{position: 'absolute', left: 20 * s, right: 20 * s, opacity: reveal.interpolate({inputRange: [0, 1], outputRange: [catalogArrivalMotion.opacity, 1]}), transformOrigin: 'top center', transform: [{translateY: reveal.interpolate({inputRange: [0, 1], outputRange: [catalogArrivalMotion.offset * s, 0]})}, {scale: reveal.interpolate({inputRange: [0, 1], outputRange: [catalogArrivalMotion.scale, 1]})}]}}>
        {batch.added.map(row)}
      </Animated.View>
    </Animated.View>}
    {batch.rest.map(row)}
  </View>;
}
