// @vitest-environment jsdom
import {act, useLayoutEffect, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import type {GestureResponderEvent, LayoutChangeEvent, PanResponderCallbacks} from 'react-native';
import {afterEach, expect, it, vi} from 'vitest';
import {ProfilePhotoEditor} from '../src/ui/settings/ProfilePhotoEditor';
import type {SettingsNavigation} from '../src/ui/settings/controls';

type ViewProps = {
  children?: ReactNode; testID?: string; onLayout?: (event: LayoutChangeEvent) => void;
  responder?: PanResponderCallbacks; onAccessibilityAction?: (event: {nativeEvent: {actionName: string}}) => void;
};
const mocks = vi.hoisted(() => ({convert: vi.fn(), views: new Map<string, ViewProps>()}));
vi.mock('../src/adapters/profile/cropProfileImage', () => ({cropProfileImage: mocks.convert}));
vi.mock('react-native', () => ({
  View: (props: ViewProps) => {
    if (props.testID) mocks.views.set(props.testID, props);
    useLayoutEffect(() => {
      const dimensions = props.testID === 'ui-profile-crop-stage' ? {width: 412, height: 600}
        : props.testID === 'ui-profile-photo-zoom' ? {width: 280, height: 48} : null;
      if (dimensions) props.onLayout?.({nativeEvent: {layout: dimensions}} as LayoutChangeEvent);
    }, []);
    return <div data-testid={props.testID}>{props.children}</div>;
  },
  Text: ({children}: {children: ReactNode}) => <span>{children}</span>,
  Image: ({onLoad, onError}: {onLoad: () => void; onError: () => void}) => <img alt="photo" onLoad={onLoad} onError={onError}/>,
  ActivityIndicator: () => <span>saving</span>,
  PanResponder: {create: (responder: PanResponderCallbacks) => ({panHandlers: {responder}})},
  StyleSheet: {absoluteFill: {}}, Platform: {OS: 'web'},
}));
vi.mock('../src/ui/Theme', () => ({usePalette: () => ({background: '#fff', surface: '#f2f2f2', foreground: '#101010', secondaryForeground: '#777', border: '#ddd'})}));
vi.mock('../src/ui/Navigation', () => ({NavigationButton: ({label, onPress}: {label: string; onPress?: () => void}) => <button aria-label={label} disabled={!onPress} onClick={onPress}/>}));
vi.mock('../src/ui/settings/controls', () => ({
  SettingsHeader: ({nav, action, backDisabled}: {nav: SettingsNavigation; action: ReactNode; backDisabled: boolean}) => <>
    <button aria-label="뒤로" disabled={backDisabled} onClick={nav.back}/>{action}</>,
  Note: ({children}: {children: ReactNode}) => <span>{children}</span>,
}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
const photo = {uri: 'file:///photo.jpg', width: 800, height: 1200};
const image = 'data:image/png;base64,Y3JvcA==';
let root: Root | undefined;
afterEach(async () => {await act(async () => root?.unmount()); root = undefined; document.body.replaceChildren(); mocks.convert.mockReset(); mocks.views.clear();});
const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const click = async (label: string) => {await act(async () => button(label).click());};
async function render(onSave = vi.fn(async () => {}), load = true) {
  const back = vi.fn(), blockBack = vi.fn();
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<ProfilePhotoEditor photo={photo} nav={{back, blockBack, push: vi.fn(), scale: 2 / 3, bottomInset: 24}} onSave={onSave}/>));
  if (load) await act(async () => document.querySelector('img')!.dispatchEvent(new Event('load')));
  return {back, blockBack, onSave};
}
function touch(points: number[][]) {
  return {nativeEvent: {touches: points.map(([x, y]) => ({locationX: x, locationY: y, pageX: x, pageY: y}))}} as GestureResponderEvent;
}
async function drag(name: 'onPanResponderGrant' | 'onPanResponderMove' | 'onPanResponderEnd', points: number[][]) {
  const responder = mocks.views.get('ui-profile-crop-stage')!.responder!;
  await act(async () => responder[name]!(touch(points), {} as never));
}
async function adjust() {
  await drag('onPanResponderGrant', [[156, 300], [256, 300]]);
  await drag('onPanResponderMove', [[106, 300], [306, 300]]); // 2× zoom.
  await drag('onPanResponderEnd', [[206, 300]]); // Rebase to one finger.
  await drag('onPanResponderMove', [[246, 330]]); // Pan 40px right and 30px down.
}
it('keeps confirmation disabled until the image loads and cancels a changed preview without exporting', async () => {
  const {back, onSave} = await render(undefined, false);
  expect(button('사진 적용').disabled).toBe(true);
  await act(async () => document.querySelector('img')!.dispatchEvent(new Event('load')));
  await adjust(); await click('뒤로');
  expect(back).toHaveBeenCalledOnce(); expect(mocks.convert).not.toHaveBeenCalled(); expect(onSave).not.toHaveBeenCalled();
});
it('exports the visible pinch-and-pan crop once and blocks back until the image is persisted', async () => {
  let finish!: () => void;
  const onSave = vi.fn(() => new Promise<void>(resolve => {finish = resolve;}));
  mocks.convert.mockResolvedValue(image);
  const {back, blockBack} = await render(onSave);
  await adjust(); await click('사진 적용'); await click('사진 적용'); await click('뒤로');
  expect(mocks.convert).toHaveBeenCalledExactlyOnceWith(photo, {x: 156, y: 367, size: 400});
  expect(onSave).toHaveBeenCalledExactlyOnceWith(image); expect(back).not.toHaveBeenCalled();
  expect(blockBack).toHaveBeenLastCalledWith(true);
  await act(async () => finish());
  expect(back).toHaveBeenCalledOnce(); expect(blockBack).toHaveBeenLastCalledWith(false);
});
it('preserves the crop across resizing and a failed save, then retries it unchanged', async () => {
  mocks.convert.mockResolvedValue(image);
  const onSave = vi.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined);
  const {back, blockBack} = await render(onSave);
  await adjust();
  await act(async () => mocks.views.get('ui-profile-crop-stage')!.onLayout!({nativeEvent: {layout: {width: 600, height: 320}}} as LayoutChangeEvent));
  await click('사진 적용');
  expect(back).not.toHaveBeenCalled(); expect(document.body.textContent).toContain('다시 시도');
  expect(blockBack).toHaveBeenLastCalledWith(false);
  await click('사진 적용');
  expect(mocks.convert.mock.calls).toEqual([[photo, {x: 156, y: 367, size: 400}], [photo, {x: 156, y: 367, size: 400}]]);
  expect(back).toHaveBeenCalledOnce();
});
it('can zoom through the accessible slider and never saves after the editor is unmounted', async () => {
  let finish!: (value: string) => void;
  mocks.convert.mockImplementation(() => new Promise(resolve => {finish = resolve;}));
  const {onSave, blockBack} = await render();
  await act(async () => mocks.views.get('ui-profile-photo-zoom')!.onAccessibilityAction!({nativeEvent: {actionName: 'increment'}}));
  await click('사진 적용');
  expect(mocks.convert).toHaveBeenCalledWith(photo, {x: 37, y: 237, size: 727});
  await act(async () => root!.unmount()); root = undefined;
  await act(async () => finish(image));
  expect(onSave).not.toHaveBeenCalled(); expect(blockBack).toHaveBeenLastCalledWith(false);
});
