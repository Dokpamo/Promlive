import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, Platform, View} from 'react-native';
import type {AiModelPreview} from '../../features/settings/aiSettingsModel';
import {settingsListLayout} from '../tokens';
import {SettingRow} from './controls';
import {useDesktopPane} from '../desktop/DesktopPane';
import {desktopMetrics} from '../desktop/desktopMetrics';

type Row = {
  model: AiModelPreview; present: boolean; fresh: boolean; targetY: number;
  y: Animated.Value; opacity: Animated.Value;
};
type Frame = {rows: Row[]; height: number; animate: boolean; moveStart: number; moveDuration: number};
const useNativeDriver = Platform.OS === 'ios' || Platform.OS === 'android';
const smooth = (value: number) => value * value * (3 - 2 * value);

function initialFrame(models: AiModelPreview[], rowHeight: number): Frame {
  return {rows: models.map((model, index) => ({model, present: true, fresh: false, targetY: index * rowHeight,
    y: new Animated.Value(index * rowHeight), opacity: new Animated.Value(1)})),
    height: models.length * rowHeight, animate: false, moveStart: 0, moveDuration: 360};
}

/** Move whole rows to make space, then reveal arrivals. Animated values survive interrupted updates. */
export function AnimatedModelRows({models, selected, onChoose}: {
  models: AiModelPreview[]; selected: string; onChoose: (model: AiModelPreview) => void;
}) {
  const rowHeight = useDesktopPane() ? desktopMetrics.rowHeight : settingsListLayout.rowHeight;
  const [frame, setFrame] = useState(() => initialFrame(models, rowHeight));
  const current = useRef(frame);
  const height = useRef(new Animated.Value(frame.height)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const generation = useRef(0);
  const heights = useRef(new Map<string, number>());
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const previous = useRef({models, layoutVersion, reducedMotion});
  useEffect(() => {
    let alive = true;
    const update = (value: boolean) => {if (alive) setReducedMotion(value);};
    void AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => {alive = false; subscription?.remove();};
  }, []);

  const measure = useCallback((id: string, measured: number) => {
    if (!Number.isFinite(measured) || measured <= 0 || Math.abs((heights.current.get(id) ?? rowHeight) - measured) < .5) return;
    heights.current.set(id, measured);
    setLayoutVersion(value => value + 1);
  }, [rowHeight]);

  useLayoutEffect(() => {
    const oldInput = previous.current;
    if (oldInput.models === models && oldInput.layoutVersion === layoutVersion && oldInput.reducedMotion === reducedMotion) return;
    previous.current = {models, layoutVersion, reducedMotion};
    ++generation.current;
    animation.current?.stop();

    const old = current.current;
    const oldRows = new Map(old.rows.map(row => [row.model.id, row]));
    const oldIds = old.rows.filter(row => row.present).map(row => row.model.id);
    const ids = new Set(models.map(model => model.id));
    const changed = oldIds.length !== models.length || models.some((model, index) => model.id !== oldIds[index]);
    const animate = !reducedMotion && (changed || old.animate);
    let targetHeight = 0, maxDistance = 0;
    const rows: Row[] = models.map(model => {
      const existing = oldRows.get(model.id), targetY = targetHeight;
      targetHeight += heights.current.get(model.id) ?? rowHeight;
      if (existing) maxDistance = Math.max(maxDistance, Math.abs(targetY - existing.targetY));
      return {model, present: true, fresh: existing ? existing.fresh && !changed : true, targetY,
        y: existing?.y ?? new Animated.Value(targetY - (animate ? 4 : 0)),
        opacity: existing?.opacity ?? new Animated.Value(animate ? 0 : 1)};
    });
    const leaving = old.rows.filter(row => !ids.has(row.model.id));
    if (animate) rows.push(...leaving.map(row => ({...row, present: false, fresh: false})));
    const next: Frame = {rows, height: targetHeight, animate, moveStart: leaving.length ? 50 : 0,
      moveDuration: 360 + Math.min(120, Math.max(0, maxDistance - rowHeight) * .55)};
    current.current = next;
    setFrame(next);
  }, [models, layoutVersion, reducedMotion, rowHeight]);

  useEffect(() => {
    const run = ++generation.current;
    if (!frame.animate) {
      height.setValue(frame.height);
      frame.rows.forEach(row => {row.y.setValue(row.targetY); row.opacity.setValue(1);});
      return;
    }
    const revealStart = frame.moveStart + frame.moveDuration - 70;
    const motions: Animated.CompositeAnimation[] = [Animated.timing(height, {
      toValue: frame.height, delay: frame.moveStart, duration: frame.moveDuration,
      easing: smooth, useNativeDriver: false, isInteraction: false,
    })];
    frame.rows.forEach(row => {
      if (!row.present) {
        motions.push(Animated.timing(row.opacity, {toValue: 0, duration: 140, easing: smooth, useNativeDriver, isInteraction: false}));
        return;
      }
      motions.push(Animated.timing(row.y, {toValue: row.targetY,
        delay: row.fresh ? revealStart : frame.moveStart, duration: row.fresh ? 240 : frame.moveDuration,
        easing: smooth, useNativeDriver, isInteraction: false}));
      motions.push(Animated.timing(row.opacity, {toValue: 1, delay: row.fresh ? revealStart : 0,
        duration: 240, easing: smooth, useNativeDriver, isInteraction: false}));
    });
    const batch = Animated.parallel(motions);
    animation.current = batch;
    batch.start(({finished}) => {
      if (!finished || generation.current !== run || current.current !== frame) return;
      const settled: Frame = {...frame, animate: false, rows: frame.rows.filter(row => row.present).map(row => ({...row, fresh: false}))};
      current.current = settled;
      setFrame(settled);
    });
    return () => {++generation.current; batch.stop(); if (animation.current === batch) animation.current = null;};
  }, [frame, height]);

  return <Animated.View testID="ui-model-list" style={{height, position: 'relative'}}>
    {frame.rows.map(row => {
      const hidden = !row.present || (frame.animate && row.fresh);
      return <Animated.View key={row.model.id} testID={`ui-model-position-${row.model.id}`}
        pointerEvents={hidden ? 'none' : 'auto'} aria-hidden={hidden} accessibilityElementsHidden={hidden}
        importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
        style={{position: 'absolute', left: 0, right: 0, top: 0, opacity: row.opacity, transform: [{translateY: row.y}]}}>
        <View onLayout={event => measure(row.model.id, event.nativeEvent.layout.height)}>
          <SettingRow testID={`ui-model-${row.model.id}`} label={row.model.name} selected={selected === row.model.id}
            disabled={hidden} dimDisabled={false} onPress={() => onChoose(row.model)}/>
        </View>
      </Animated.View>;
    })}
  </Animated.View>;
}
