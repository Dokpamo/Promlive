import {Animated, Easing, Platform} from 'react-native';
import {tabPressFeedback} from './tabReleaseWave';

/** Navigation remains immediate; only valid release starts a native wave. */
export function createTabPressMotion(initialSelected: boolean) {
  const fill = new Animated.Value(initialSelected ? 1 : 0);
  const lanes = Array.from({length: 3}, () => ({value: new Animated.Value(1), active: false, revision: 0}));
  const waves = lanes.map(lane => lane.value);
  const driver = {useNativeDriver: Platform.OS === 'ios' || Platform.OS === 'android', isInteraction: false};
  let selected = initialSelected, reduced = false, disposed = false, nextLane = 0, revision = 0;
  let phase: 'idle' | 'pressed' | 'released' = 'idle';
  const settleFill = () => {fill.stopAnimation(); fill.setValue(selected ? 1 : 0);};
  const animateFill = () => {
    fill.stopAnimation();
    if (!selected || reduced) fill.setValue(selected ? 1 : 0);
    else Animated.timing(fill, {...driver, toValue: 1, duration: tabPressFeedback.fillMs, easing: Easing.inOut(Easing.quad)}).start();
  };
  const stopWaves = () => lanes.forEach(lane => {
    lane.revision++; lane.active = false; lane.value.stopAnimation(); lane.value.setValue(1);
  });
  return {
    waves, fill,
    mount() {
      if (!disposed) return;
      disposed = false; phase = 'idle'; stopWaves(); settleFill();
    },
    setSelected(value: boolean) {
      selected = value;
      if (disposed) return;
      if (!value || reduced || phase === 'idle') settleFill();
      else if (phase === 'released') animateFill();
    },
    setReduced(value: boolean) {
      reduced = value;
      if (!value || disposed) return;
      revision++; phase = 'idle'; stopWaves(); settleFill();
    },
    press() {if (!disposed) {revision++; phase = 'pressed';}},
    endPress() {
      // Pressable can call onPressOut before OR after onPress. Cancelled/dragged
      // touches settle quietly, while a valid onPress owns the release pulse.
      const id = revision;
      queueMicrotask(() => {
        if (disposed || id !== revision || phase !== 'pressed') return;
        phase = 'idle'; settleFill();
      });
    },
    release() {
      if (disposed) return;
      revision++; phase = 'released';
      if (reduced) {phase = 'idle'; settleFill(); return;}
      animateFill();
      const lane = lanes[nextLane]!; nextLane = (nextLane + 1) % lanes.length;
      const id = ++lane.revision;
      lane.value.stopAnimation(); lane.value.setValue(0); lane.active = true;
      Animated.timing(lane.value, {...driver, toValue: 1, duration: tabPressFeedback.releaseMs, easing: Easing.linear})
        .start(({finished}) => {
          if (!finished || disposed || lane.revision !== id) return;
          lane.active = false;
          if (phase === 'released' && lanes.every(item => !item.active)) phase = 'idle';
        });
    },
    dispose() {disposed = true; revision++; phase = 'idle'; stopWaves(); fill.stopAnimation();},
  };
}
