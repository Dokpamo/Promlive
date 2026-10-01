// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {AccessibilityInfo, Animated} from 'react-native';
import {afterEach, expect, it, vi} from 'vitest';
import {useSwipeMotion} from '../src/ui/useSwipeMotion';
import {createBackTransition} from '../src/ui/backTransition';

vi.mock('react-native', () => vi.importActual('react-native-web'));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

it('ignores a finger-up from the page replaced by a tab press and accepts the next gesture', async () => {
  let motion!: ReturnType<typeof useSwipeMotion>;
  const onStep = vi.fn();
  const timing = vi.spyOn(Animated, 'timing');
  function Host({identity}: {identity: string}) {
    motion = useSwipeMotion({identity, width: 412, previous: true, next: identity !== 'settings', onStep});
    return null;
  }
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<Host identity="settings"/>));
  await act(async () => {motion.onStart(); motion.translation.setValue(180);});
  const oldRelease = motion.onRelease;
  await act(async () => root!.render(<Host identity="create:external"/>));
  await act(async () => oldRelease(180, 0, false));
  expect(timing).not.toHaveBeenCalled();
  expect(onStep).not.toHaveBeenCalled();
  expect(motion.settling).toBe(false);
  await act(async () => {motion.onStart(); motion.onRelease(-180, 0, false);});
  expect(timing).toHaveBeenCalledTimes(1);
});

it('keeps the mounted native transform connected when switching between end tabs and middle tabs', async () => {
  let motion!: ReturnType<typeof useSwipeMotion>;
  const onStep = vi.fn();
  function Host({identity, previous, next}: {identity: string; previous: boolean; next: boolean}) {
    motion = useSwipeMotion({identity, width: 412, previous, next, onStep});
    return null;
  }
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<Host identity="settings" previous next={false}/>));
  // Native page/body layers retain this graph. Replacing it during a tab change
  // can restore old view properties after React has selected the new screen.
  const attached = motion.translateX;
  const displayed = () => (attached as unknown as {__getValue(): number}).__getValue();
  await act(async () => motion.translation.setValue(-80));
  expect(displayed()).toBe(0);

  for (const [identity, previous, next] of [
    ['create:external', true, true], ['library:all', false, true],
    ['settings', true, false], ['create:all', true, true],
  ] as const) {
    await act(async () => root!.render(<Host identity={identity} previous={previous} next={next}/>));
    expect(motion.translateX).toBe(attached);
    expect(displayed()).toBe(0);
    for (const x of [-600, -90, 120, 600]) {
      await act(async () => motion.translation.setValue(x));
      expect(displayed()).toBeCloseTo(x < 0 ? (next ? Math.max(-412, x) : 0) : (previous ? Math.min(412, x) : 0));
    }
  }
  expect(onStep).not.toHaveBeenCalled();
});

it('reverses an unfinished entrance and continues closing when keyboard focus enables the gesture', async () => {
  vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  const source = new Animated.Value(0);
  const transition = createBackTransition(source, 412, {topLeft: 30, topRight: 30, bottomLeft: 30, bottomRight: 30});
  transition.prepareOpen();
  const position = () => (source as unknown as {__getValue(): number}).__getValue();
  const springs: Array<{from: number; to: unknown; finish: () => void}> = [];
  vi.spyOn(Animated, 'spring').mockImplementation((_value, config) => ({
    start: done => {springs.push({from: position(), to: config.toValue, finish: () => done?.({finished: true})});},
    stop: () => {}, reset: () => {},
  }));
  let motion!: ReturnType<typeof useSwipeMotion>;
  const onStep = vi.fn();
  function Host({dismiss = false, enabled = false}: {dismiss?: boolean; enabled?: boolean}) {
    motion = useSwipeMotion({identity: 'settings-choice', width: 412, previous: true, next: false,
      source, entrance: transition, release: 'back', dismiss, enabled, onStep});
    return null;
  }
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<Host/>));
  expect(springs[0]).toMatchObject({from: 412, to: 0});
  await act(async () => source.setValue(160));
  await act(async () => root!.render(<Host dismiss/>));
  expect(springs[1]).toMatchObject({from: 160, to: 412});
  await act(async () => springs[0]!.finish());
  expect(position()).toBe(160);
  expect(onStep).not.toHaveBeenCalled();

  await act(async () => source.setValue(280));
  await act(async () => root!.render(<Host dismiss enabled/>));
  expect(springs[2]).toMatchObject({from: 280, to: 412});
  expect(motion.enabled).toBe(false);
  await act(async () => springs[1]!.finish());
  expect(onStep).not.toHaveBeenCalled();
  await act(async () => springs[2]!.finish());
  expect(onStep).toHaveBeenCalledExactlyOnceWith(-1);
});
