// @vitest-environment jsdom
import './ui-image-fixtures';
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {Animated, type View} from 'react-native';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {SearchHeader} from '../src/ui/SearchHeader';
import {ScreenActiveContext} from '../src/ui/ScreenLayer';
import {DesktopPane} from '../src/ui/desktop/DesktopPane';
import {DesktopSearchDismissal} from '../src/ui/desktop/DesktopSearchDismissal';

vi.mock('react-native', async () => {
  const native = await vi.importActual<typeof import('react-native')>('react-native-web');
  return {...native, AccessibilityInfo: {...native.AccessibilityInfo, isReduceMotionEnabled: async () => false},
    useWindowDimensions: () => ({width: 412, height: 892, scale: 1, fontScale: 1})};
});
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let motions: {finish: () => void; stop: ReturnType<typeof vi.fn>}[];
const close = vi.fn();
const field = () => document.querySelector<HTMLInputElement>('[data-testid="ui-create-search-input"]');
beforeEach(() => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  motions = []; close.mockClear();
  vi.spyOn(Animated, 'timing').mockImplementation((value, config) => {
    const stop = vi.fn();
    return {start: callback => motions.push({stop, finish: () => {(value as Animated.Value).setValue(config.toValue as number); callback?.({finished: true});}}), stop, reset: () => {}};
  });
});
afterEach(async () => {await act(async () => root.unmount()); document.body.replaceChildren(); vi.restoreAllMocks();});
async function render(open: boolean, active = true, query = '', desktop = false) {
  const header = <ScreenActiveContext.Provider value={active}>
    <SearchHeader scale={2 / 3} height={64} trailingWidth={48}
      search={{scope: 'create', open, query, onQueryChange: () => {}, onClose: close}}><div>생성</div></SearchHeader>
  </ScreenActiveContext.Provider>;
  await act(async () => root.render(desktop ? <DesktopSearchDismissal testID="desktop-frame">
    <DesktopPane width={412} height={892}>{header}<button data-testid="outside">다른 항목</button></DesktopPane>
  </DesktopSearchDismissal> : header));
}

it('focuses when expansion starts and ignores interrupted animation completions', async () => {
  await render(false); await render(true);
  const first = field();
  expect(first).not.toBeNull(); expect(document.activeElement).toBe(first);
  await render(false); expect(motions[0]!.stop).toHaveBeenCalled();
  expect(document.activeElement).not.toBe(first);
  expect(field()).toBe(first); // The exiting input stays painted until closing completes.
  await act(async () => motions[0]!.finish());
  expect(document.activeElement).not.toBe(first);
  await render(true);
  expect(document.activeElement).toBe(first);
  await act(async () => motions[1]!.finish());
  expect(field()).toBe(first); expect(document.activeElement).toBe(first);
  await act(async () => motions[2]!.finish());
  expect(field()).toBe(first); expect(document.activeElement).toBe(first);
  await render(false); await act(async () => motions[3]!.finish());
  expect(field()).toBeNull();
});

it('restores an open search without animating or focusing it when a covered page becomes visible', async () => {
  await render(true, false, '별');
  const input = field(); expect(input?.value).toBe('별');
  expect(motions).toHaveLength(0); expect(document.activeElement).not.toBe(input);
  await render(true, true, '별');
  expect(field()).toBe(input); expect(document.activeElement).not.toBe(input); expect(motions).toHaveLength(0);
});

it('blurs a covered search and does not refocus it on return or animation completion', async () => {
  await render(false); await render(true);
  expect(document.activeElement).toBe(field());
  await render(true, false);
  expect(document.activeElement).not.toBe(field());
  await render(true);
  expect(document.activeElement).not.toBe(field());
  await act(async () => motions[0]!.finish());
  expect(field()).not.toBeNull(); expect(document.activeElement).not.toBe(field());
});

it('keeps the input mounted while the query changes and consumes Escape before page navigation', async () => {
  await render(false); await render(true); await act(async () => motions[0]!.finish());
  const input = field()!;
  await render(true, true, '도서관'); expect(field()).toBe(input); expect(input.value).toBe('도서관');
  expect(motions).toHaveLength(1);
  const event = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true});
  await act(async () => input.dispatchEvent(event));
  expect(close).toHaveBeenCalledOnce(); expect(event.defaultPrevented).toBe(true);
});

it('dismisses only an empty desktop search on outside clicks, without swallowing the clicked action', async () => {
  await render(false, true, '', true); await render(true, true, '', true);
  expect(document.activeElement).toBe(field());
  const boundary = document.querySelector('[data-testid="ui-create-search-header"]') as unknown as View;
  vi.spyOn(boundary, 'measure').mockImplementation(callback => callback(0, 0, 412, 64, 64, 0));
  const outside = document.querySelector<HTMLButtonElement>('[data-testid="outside"]')!, pressed = vi.fn();
  outside.addEventListener('click', pressed);
  const clickAt = async (target: HTMLElement, x: number, y: number) => act(async () => {
    target.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: x, clientY: y, button: 0}));
    target.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: x, clientY: y, button: 0}));
    target.click();
  });
  await clickAt(field()!, 150, 32); expect(close).not.toHaveBeenCalled();
  await clickAt(outside, 700, 200); expect(close).toHaveBeenCalledOnce(); expect(pressed).toHaveBeenCalledOnce();
  close.mockClear();
  await render(true, true, '도서관', true);
  await clickAt(outside, 700, 200); expect(close).not.toHaveBeenCalled(); expect(field()?.value).toBe('도서관');
  await render(true, true, '   ', true);
  await clickAt(outside, 700, 200); expect(close).toHaveBeenCalledOnce();
});
