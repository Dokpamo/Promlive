import {Animated} from 'react-native';
import {afterEach, expect, it, vi} from 'vitest';
import {createRootPageLayout} from '../src/ui/rootPageLayout';
import {createRootTabTransition} from '../src/ui/rootTabTransition';
import {initialScreenView} from '../src/ui/screenState';

vi.mock('react-native', () => vi.importActual('react-native-web'));
afterEach(() => vi.restoreAllMocks());
const read = (node: Animated.Value) => (node as unknown as {__getValue: () => number}).__getValue();

function setup() {
  const home = {...initialScreenView(), tab: 'library' as const};
  const settings = {...home, tab: 'settings' as const};
  const layout = createRootPageLayout(home, 412);
  const moving = vi.fn();
  const transition = createRootTabTransition(layout, moving);
  const runs: {node: Animated.Value; to: number; complete: () => void; stop: ReturnType<typeof vi.fn>}[] = [];
  vi.spyOn(Animated, 'timing').mockImplementation((node, config) => {
    const run = {node: node as Animated.Value, to: config.toValue as number, complete: () => {}, stop: vi.fn()};
    return {start: callback => {run.complete = () => callback?.({finished: true}); runs.push(run);}, stop: run.stop, reset() {}};
  });
  const finish = (batch = runs.slice(-2)) => batch.forEach(run => {run.node.setValue(run.to); run.complete();});
  return {home, settings, layout, moving, transition, runs, finish};
}

it('places a distant tab exactly one screen away, without painting the skipped tabs', () => {
  const {home, settings, layout, transition, runs, finish, moving} = setup();
  transition.prepare(home, settings, 412);
  transition.sync(settings, 412, true); // React selection must retain the departure positions.
  expect(read(layout.slots['library:all'].page)).toBe(0);
  expect(read(layout.slots.settings.page)).toBe(412);
  expect(read(layout.slots.chats.visible)).toBe(0);
  expect(read(layout.slots['create:all'].visible)).toBe(0);
  transition.start(false);
  expect(runs.map(run => run.to)).toEqual([-412, 0]);
  runs.forEach(run => run.node.setValue(read(run.node) - 150));
  expect(read(layout.slots.settings.page) - read(layout.slots['library:all'].page)).toBe(412);
  finish();
  expect(read(layout.slots.settings.page)).toBe(0);
  expect(moving).toHaveBeenLastCalledWith(false);
  transition.prepare(settings, home, 412);
  expect(read(layout.slots['library:all'].page)).toBe(-412);
  transition.start(false);
  expect(runs.slice(-2).map(run => run.to)).toEqual([412, 0]);
});

it('reverses from the live positions and ignores completed callbacks from replaced transitions', () => {
  const {home, settings, layout, transition, runs, finish, moving} = setup();
  transition.prepare(home, settings, 412); transition.start(false);
  const old = runs.slice();
  layout.slots['library:all'].page.setValue(-170); layout.slots.settings.page.setValue(242);
  transition.prepare(settings, home, 412);
  expect(old.every(run => run.stop.mock.calls.length === 1)).toBe(true);
  expect(read(layout.slots['library:all'].page)).toBe(-170);
  expect(read(layout.slots.settings.page)).toBe(242);
  transition.start(false);
  old.forEach(run => run.complete());
  expect(read(layout.slots['library:all'].page)).toBe(-170);
  expect(moving).toHaveBeenLastCalledWith(true);
  finish();
  expect(read(layout.slots['library:all'].page)).toBe(0);
  expect(read(layout.slots.settings.visible)).toBe(0);
});

it('replaces a running transition with a third tab and keeps its stored filter', () => {
  const {home, settings, layout, transition, runs, finish} = setup();
  transition.prepare(home, settings, 412); transition.start(false);
  layout.slots['library:all'].page.setValue(-100); layout.slots.settings.page.setValue(312);
  const create = {...settings, tab: 'create' as const, creationFilter: 'external' as const};
  transition.prepare(settings, create, 412); transition.start(false);
  expect(read(layout.slots['create:external'].page)).toBe(-412);
  expect(read(layout.slots['create:all'].visible)).toBe(0);
  finish(runs.slice(-3));
  expect(read(layout.slots['create:external'].page)).toBe(0);
  expect(read(layout.slots['create:external'].visible)).toBe(1);
});

it('settles immediately for reduced motion and cancels safely on a size change', () => {
  const {home, settings, layout, transition, runs, moving} = setup();
  transition.prepare(home, settings, 412); transition.start(true);
  expect(runs).toHaveLength(0);
  expect(read(layout.slots.settings.page)).toBe(0);
  expect(moving).toHaveBeenLastCalledWith(false);
  transition.prepare(settings, home, 412); transition.start(false);
  transition.sync(home, 600, true);
  runs.forEach(run => run.complete());
  expect(read(layout.slots['library:all'].page)).toBe(0);
  expect(read(layout.slots.settings.visible)).toBe(0);
  expect(moving).toHaveBeenLastCalledWith(false);
});
