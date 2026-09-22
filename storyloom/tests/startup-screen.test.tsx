// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {useStartupScreen} from '../src/layout/StartupScreen';

const native = vi.hoisted(() => ({theme: 'light', ready: vi.fn()}));
vi.mock('react-native', () => ({Platform: {OS: 'android'}, NativeModules: {PromliveStartup: native}}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
beforeEach(() => {
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  frames = new Map(); nextFrame = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {frames.set(++nextFrame, callback); return nextFrame;});
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});
afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren(); native.ready.mockClear(); vi.unstubAllGlobals();
});
function Screen({ready, theme = 'light'}: {ready: boolean; theme?: 'light' | 'dark'}) {
  useStartupScreen(ready, theme);
  return <div>{ready ? 'Restored app or error' : 'Restoring'}</div>;
}
async function render(ready: boolean, theme: 'light' | 'dark' = 'light') {
  await act(async () => root.render(<Screen ready={ready} theme={theme}/>));
}
async function draw() {
  await act(async () => {const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(0));});
}

it('keeps the launch screen through restoration and releases it with the ready UI frame', async () => {
  await render(false); await draw();
  expect(native.ready).not.toHaveBeenCalled();
  await render(true);
  expect(native.ready).not.toHaveBeenCalled();
  await draw();
  expect(native.ready).toHaveBeenCalledExactlyOnceWith('light');
});

it('cancels stale frames when the theme changes or the ready screen is removed', async () => {
  await render(true, 'light'); await render(true, 'dark'); await draw();
  expect(native.ready).toHaveBeenCalledExactlyOnceWith('dark');
  native.ready.mockClear();
  await render(true, 'light');
  await act(async () => root.render(null));
  await draw();
  expect(native.ready).not.toHaveBeenCalled();
});
