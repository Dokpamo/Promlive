// @vitest-environment jsdom
import {act, useState, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import type {GestureResponderEvent, PanResponderCallbacks, PanResponderGestureState} from 'react-native';
import {PhotoZoomSlider} from '../src/features/profile/PhotoZoomSlider';

const events = vi.hoisted(() => ({pan: {} as PanResponderCallbacks}));
vi.mock('react-native', async () => {
  const React = await import('react');
  const native = await vi.importActual<typeof import('react-native')>('react-native-web');
  const View = ({children, testID, onLayout, accessibilityValue}: {children?: ReactNode; testID?: string; onLayout?: (event: unknown) => void; accessibilityValue?: {now?: number}}) => {
    React.useLayoutEffect(() => {if (testID === 'profile-photo-zoom') onLayout?.({nativeEvent: {layout: {width: 320}}});}, []);
    return <div data-testid={testID} data-value={accessibilityValue?.now}>{children}</div>;
  };
  const animate = (value: {setValue: (next: number) => void}, config: {toValue: number}) => ({start: (done?: (result: {finished: boolean}) => void) => {value.setValue(config.toValue); done?.({finished: true});}, stop() {}});
  return {...native, View, Text: ({children}: {children: ReactNode}) => <span>{children}</span>,
    AccessibilityInfo: {isReduceMotionEnabled: async () => true, addEventListener: () => ({remove() {}})},
    Animated: {...native.Animated, View, timing: animate},
    PanResponder: {create: (callbacks: PanResponderCallbacks) => {events.pan = callbacks; return {panHandlers: {}};}},
  };
});

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
async function render(initial: number) {
  function Host() {
    const [value, onChange] = useState(initial);
    return <PhotoZoomSlider value={value} onChange={onChange} disabled={false}/>;
  }
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<Host/>));
}
afterEach(async () => {await act(async () => root?.unmount()); root = undefined; document.body.replaceChildren();});
const event = (locationX: number) => ({nativeEvent: {locationX}} as GestureResponderEvent);
const gesture = (dx: number) => ({dx, numberActiveTouches: 1} as PanResponderGestureState);
const zoom = () => Number(document.querySelector('[data-testid="profile-photo-zoom"]')!.getAttribute('data-value'));
async function begin(x: number) {await act(async () => {events.pan.onPanResponderGrant!(event(x), gesture(0));});}
async function move(x: number, dx: number) {await act(async () => {events.pan.onPanResponderMove!(event(x), gesture(dx));});}
async function release() {await act(async () => {events.pan.onPanResponderRelease!(event(0), gesture(0));});}

it('holds the maximum when local coordinates reset outside the track, including after regrabbing', async () => {
  await render(2.5); await begin(160);
  await move(310, 150); expect(zoom()).toBe(400);
  await move(0, 220); expect(zoom()).toBe(400);
  await release(); expect(zoom()).toBe(400);
  await begin(315); await move(0, 60); expect(zoom()).toBe(400);
});

it('holds the minimum when Android switches locationX to a positive screen coordinate outside the left edge', async () => {
  await render(4); await begin(310);
  await move(10, -300); expect(zoom()).toBe(100);
  await move(50, -320); expect(zoom()).toBe(100);
  await move(20, -350); expect(zoom()).toBe(100);
  await release(); expect(zoom()).toBe(100);
});

it('keeps off-center thumb grabs stable and resumes normally when the finger returns from an edge', async () => {
  await render(2.5); await begin(168); expect(zoom()).toBe(250);
  await move(0, 50); expect(zoom()).toBe(300);
  await move(0, 250); expect(zoom()).toBe(400);
  await move(0, 100); expect(zoom()).toBe(350);
});
