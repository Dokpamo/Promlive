// @vitest-environment jsdom
import {act, useLayoutEffect, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {ProfilePhotoCrop} from '../src/features/profile/ProfilePhotoCrop';

const convert = vi.hoisted(() => vi.fn());
vi.mock('../src/adapters/profile/cropProfileImage', () => ({cropProfileImage: convert}));
vi.mock('react-native', () => ({
  View: ({children, testID, onLayout}: {children: ReactNode; testID?: string; onLayout?: (event: unknown) => void}) => {
    useLayoutEffect(() => {if (testID === 'profile-crop-stage') onLayout?.({nativeEvent: {layout: {width: 412, height: 600}}});}, []);
    return <div data-testid={testID}>{children}</div>;
  },
  Text: ({children}: {children: ReactNode}) => <span>{children}</span>,
  Image: ({onLoad, onError}: {onLoad: () => void; onError: () => void}) => <img alt="photo" onLoad={onLoad} onError={onError}/>,
  ActivityIndicator: () => <span>saving</span>,
  StatusBar: () => null,
  PanResponder: {create: () => ({panHandlers: {}})}, StyleSheet: {absoluteFill: {}},
  useWindowDimensions: () => ({width: 412, height: 892}),
}));
vi.mock('react-native-safe-area-context', () => ({SafeAreaView: ({children}: {children: ReactNode}) => <div>{children}</div>}));
vi.mock('../src/layout/SwipeBackModal', () => ({
  SwipeBackBoundary: ({children}: {children: ReactNode}) => <div>{children}</div>,
  SwipeBackModal: ({children, onClose}: {children: (close: () => void) => ReactNode; onClose: () => void}) => children(onClose),
}));
vi.mock('../src/layout/ScreenHeader', () => ({
  ScreenHeader: ({children}: {children: ReactNode}) => <div>{children}</div>,
  HeaderButton: ({label, onPress, disabled}: {label: string; onPress: () => void; disabled: boolean}) => <button aria-label={label} onClick={onPress} disabled={disabled}/>,
}));
vi.mock('../src/features/profile/PhotoZoomSlider', () => ({PhotoZoomSlider: ({onChange, disabled}: {onChange: (value: number) => void; disabled: boolean}) => <button aria-label="확대 비율 조절" onClick={() => onChange(1.25)} disabled={disabled}/>}));
vi.mock('../src/features/appearance/AppAppearance', () => ({useAppearance: () => ({colors: {}, settings: {}}), syncSystemBars: vi.fn()}));

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
const photo = {uri: 'file:///photo.jpg', width: 800, height: 1200};
const image = 'data:image/png;base64,Y3JvcA==';
let root: Root | undefined;
afterEach(async () => {await act(async () => root?.unmount()); root = undefined; document.body.replaceChildren(); convert.mockReset();});
async function render(onSave: (image: string) => Promise<void>, onClose = vi.fn()) {
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<ProfilePhotoCrop photo={photo} onSave={onSave} onClose={onClose}/>));
  await act(async () => document.querySelector('img')!.dispatchEvent(new Event('load')));
  return onClose;
}
const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
async function click(label: string) {await act(async () => button(label).click());}

it('cancels an adjusted preview without exporting or replacing the saved photo', async () => {
  const save = vi.fn(); const close = await render(save);
  await click('확대 비율 조절'); await click('사진 편집 취소');
  expect(convert).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledTimes(1);
});

it('exports the adjusted crop and waits for persistence before closing, ignoring duplicate taps', async () => {
  let finish!: () => void;
  const save = vi.fn(() => new Promise<void>(resolve => {finish = resolve;}));
  convert.mockResolvedValue(image);
  const close = await render(save);
  await click('확대 비율 조절'); await click('사진 편집 완료'); await click('사진 편집 완료');
  expect(convert).toHaveBeenCalledExactlyOnceWith(photo, {x: 80, y: 280, size: 640});
  expect(save).toHaveBeenCalledExactlyOnceWith(image); expect(close).not.toHaveBeenCalled();
  expect(button('사진 편집 취소').disabled).toBe(true);
  await act(async () => finish()); expect(close).toHaveBeenCalledTimes(1);
});

it('retains the edited crop after a failed save so confirmation can be retried', async () => {
  convert.mockResolvedValue(image);
  const save = vi.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined);
  const close = await render(save);
  await click('확대 비율 조절'); await click('사진 편집 완료');
  expect(close).not.toHaveBeenCalled(); expect(document.body.textContent).toContain('다시 시도');
  await click('사진 편집 완료'); expect(save).toHaveBeenCalledTimes(2); expect(close).toHaveBeenCalledTimes(1);
  expect(convert.mock.calls[1]).toEqual(convert.mock.calls[0]);
});
