import {Animated} from 'react-native';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {createTabPressMotion} from '../src/ui/tabPressMotion';
import {releaseWaveFrame, tabPressFeedback} from '../src/ui/tabReleaseWave';

vi.mock('react-native', () => vi.importActual('react-native-web'));
beforeEach(() => vi.useFakeTimers());
afterEach(() => {vi.useRealTimers(); vi.restoreAllMocks();});
const read = (node: Animated.Value) => (node as unknown as {__getValue: () => number}).__getValue();
function setup(selected = false) {
  const runs: {node: Animated.Value; to: number; duration: number; complete: () => void}[] = [];
  vi.spyOn(Animated, 'timing').mockImplementation((node, config) => ({
    start: callback => runs.push({node: node as Animated.Value, to: config.toValue as number, duration: config.duration ?? 0, complete: () => callback?.({finished: true})}),
    stop() {}, reset() {},
  }));
  const motion = createTabPressMotion(selected);
  const finish = () => runs.forEach(run => {run.node.setValue(run.to); run.complete();});
  return {motion, runs, finish};
}

it('keeps a held icon still and starts wave/fill immediately on a valid release', () => {
  const {motion, runs, finish} = setup();
  motion.press(); motion.setSelected(true); vi.advanceTimersByTime(1000);
  expect(runs).toHaveLength(0);
  expect(motion.waves.map(read)).toEqual([1, 1, 1]);
  expect(read(motion.fill)).toBe(0);
  motion.endPress(); motion.release(); vi.runAllTicks();
  expect(runs.map(run => [run.node, run.duration])).toEqual([[motion.fill, tabPressFeedback.fillMs], [motion.waves[0], tabPressFeedback.releaseMs]]);
  expect(read(motion.waves[0]!)).toBe(0);
  expect(read(motion.fill)).toBe(0);
  finish(); expect(motion.waves.map(read)).toEqual([1, 1, 1]); expect(read(motion.fill)).toBe(1);
  motion.dispose();
});

it('does not pulse on a cancelled touch and accepts delayed native press-out after release', async () => {
  const {motion, runs} = setup();
  motion.press(); motion.setSelected(true); motion.endPress(); await Promise.resolve();
  expect(runs).toHaveLength(0); expect(read(motion.fill)).toBe(1);
  motion.press(); motion.release();
  motion.waves[0]!.setValue(.2);
  motion.endPress(); await Promise.resolve();
  expect(read(motion.waves[0]!)).toBe(.2);
  expect(runs).toHaveLength(2);
  motion.dispose();
});

it('overlaps rapid repeat releases without snapping the earlier wave back to rest', () => {
  const {motion, runs} = setup(true);
  motion.press(); motion.release(); motion.waves[0]!.setValue(.3);
  motion.press(); expect(read(motion.waves[0]!)).toBe(.3);
  motion.release();
  expect(motion.waves.map(read)).toEqual([.3, 0, 1]);
  const oldFirstWave = runs[1]!;
  motion.press(); motion.release(); motion.press(); motion.release();
  motion.waves[0]!.setValue(.15); oldFirstWave.complete();
  expect(read(motion.waves[0]!)).toBe(.15);
  motion.setSelected(false); expect(read(motion.fill)).toBe(0);
  motion.dispose();
});

it('paints swipe selection directly and stops waves when reduced motion is enabled', () => {
  const {motion, runs} = setup();
  motion.setSelected(true); expect(read(motion.fill)).toBe(1); expect(runs).toHaveLength(0);
  motion.press(); motion.release(); motion.waves[0]!.setValue(.2);
  motion.setReduced(true);
  expect(motion.waves.map(read)).toEqual([1, 1, 1]); expect(read(motion.fill)).toBe(1);
  motion.press(); motion.setSelected(false); motion.release();
  expect(read(motion.fill)).toBe(0); expect(runs).toHaveLength(2);
  motion.dispose();
});

it('cleans up cancelled-press microtasks and works after React effect replay', async () => {
  const {motion, runs} = setup();
  motion.press(); motion.setSelected(true); motion.endPress(); motion.dispose(); await Promise.resolve();
  motion.release(); expect(runs).toHaveLength(0);
  motion.mount(); expect(read(motion.fill)).toBe(1);
  motion.press(); motion.release(); expect(runs).toHaveLength(2);
  motion.dispose();
});

it('expands horizontally first, transfers a local wave, and settles without a final snap', () => {
  const early = releaseWaveFrame(10 / tabPressFeedback.releaseMs);
  expect(early.scaleX).toBeGreaterThan(1); expect(early.scaleY).toBe(1); expect(early.offset).toBeCloseTo(0);
  expect(releaseWaveFrame(.17, -.6).offset).not.toBe(releaseWaveFrame(.17, .6).offset);
  const rebound = releaseWaveFrame(.4);
  expect(rebound.scaleX).toBeLessThan(1); expect(rebound.scaleY).toBeGreaterThan(1);
  for (const t of [0, .99999, 1]) {
    const frame = releaseWaveFrame(t);
    expect(frame.scaleX).toBeCloseTo(1, 8); expect(frame.scaleY).toBeCloseTo(1, 8);
    expect(frame.offset).toBeCloseTo(0, 8); expect(frame.shear).toBeCloseTo(0, 8);
  }
});
