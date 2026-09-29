// @vitest-environment jsdom
import {act, useLayoutEffect, useRef, useState} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {MainNavigation, type MainTab} from '../src/app/MainNavigation';
import {useCollectionChrome, useCollectionSelection} from '../src/app/NavigationChrome';
import {Animated, type NativeScrollEvent, type NativeSyntheticEvent} from 'react-native';
import {useScrollChromeTarget} from '../src/layout/scrollChrome';

vi.mock('react-native', async () => ({...await vi.importActual<typeof import('react-native')>('react-native-web'),
  useWindowDimensions: () => ({width: 412, height: 892, fontScale: 1, scale: 1}),
  AccessibilityInfo: {isReduceMotionEnabled: async () => true, addEventListener: () => ({remove() {}})},
}));
vi.mock('react-native-safe-area-context', () => ({useSafeAreaInsets: () => ({top: 24, right: 0, bottom: 24, left: 0})}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(async () => {if (root) await act(async () => root!.unmount()); root = undefined; document.body.replaceChildren();});

function Page({tab, active}: {tab: MainTab; active: boolean}) {
  const [edits, setEdits] = useState(0);
  const chrome = useCollectionChrome();
  const [selecting, setSelecting] = useState(false);
  const selection = useRef(new Animated.Value(1)).current;
  useCollectionSelection(active, selecting, selection);
  const offset = useRef(0);
  const [contentOffset, setContentOffset] = useState(0);
  useLayoutEffect(() => {if (active) chrome?.setTopInset(100);}, [active, chrome?.setTopInset]);
  const event = (y: number) => ({nativeEvent: {contentOffset: {y}, contentSize: {height: 2000}, layoutMeasurement: {height: 800}}} as NativeSyntheticEvent<NativeScrollEvent>);
  useScrollChromeTarget(chrome, active, y => {offset.current = y; setContentOffset(y); chrome?.onScroll(event(y));});
  const scroll = (y: number) => {chrome?.onScrollBeginDrag(event(offset.current)); chrome?.onScroll(event(y)); chrome?.onScrollEndDrag(event(y)); offset.current = y; setContentOffset(y);};
  return <><button data-testid={`test-${tab}`} data-active={active} onClick={() => setEdits(edits + 1)}>{edits}</button>
    <button data-testid={`scroll-${tab}-down`} onClick={() => scroll(400)}>아래로</button>
    <button data-testid={`scroll-${tab}-little-up`} onClick={() => scroll(380)}>조금 위로</button>
    <button data-testid={`scroll-${tab}-up`} onClick={() => scroll(300)}>위로</button>
    <button data-testid={`scroll-${tab}-partial-down`} onClick={() => scroll(60)}>일부 내리기</button>
    <button data-testid={`scroll-${tab}-partial-up`} onClick={() => scroll(40)}>일부 올리기</button>
    <output data-testid={`offset-${tab}`}>{contentOffset}</output>
    <button data-testid={`select-${tab}`} onClick={() => {setSelecting(true); selection.setValue(0);}}>선택</button>
    <button data-testid={`selection-half-${tab}`} onClick={() => selection.setValue(0.5)}>해제 중간</button>
    <button data-testid={`selection-end-${tab}`} onClick={() => {selection.setValue(1); setSelecting(false);}}>해제 완료</button>
  </>;
}
function Host() {
  const [tab, setTab] = useState<MainTab>('library');
  return <MainNavigation tab={tab} onChange={setTab}>{(page, active) => <Page tab={page} active={active}/>}</MainNavigation>;
}
async function press(id: string) {
  const button = document.querySelector(`[data-testid="${id}"]`) as HTMLElement;
  expect(button).toBeTruthy(); await act(async () => button.click());
}
it('retains a tab’s local state, exposes only its active content and has four named tabs without Home', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<Host/>));
  expect([...document.querySelectorAll('[role="tab"]')].map(tab => tab.getAttribute('aria-label'))).toEqual(['서재', '채팅', '생성', '설정']);
  expect(document.querySelector('[data-testid="main-tab-pager"]')).toBeNull();
  await press('test-library'); await press('main-tab-chats'); await press('main-tab-create'); await press('main-tab-settings');
  expect(document.querySelector('[data-testid="main-tab-settings"]')?.getAttribute('aria-selected')).toBe('true');
  expect(document.querySelector('[data-testid="main-page-library"]')?.getAttribute('aria-hidden')).toBe('true');
  expect(document.querySelector('[data-testid="test-library"]')?.getAttribute('data-active')).toBe('false');
  await press('main-tab-library');
  expect(document.querySelector('[data-testid="test-library"]')?.textContent).toBe('1');
  expect(document.querySelector('[data-testid="test-library"]')?.getAttribute('data-active')).toBe('true');
});

it('keeps the tab bar mounted and follows selection fade progress during restoration', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<Host/>));
  const original = document.querySelector('[data-testid="main-tab-bar"]') as HTMLElement;
  await press('select-library');
  expect(document.querySelector('[data-testid="main-tab-bar"]')).toBe(original);
  expect(original.getAttribute('aria-hidden')).toBe('true');
  expect(original.style.opacity).toBe('0');
  await press('selection-half-library');
  expect(Number(original.style.opacity)).toBeCloseTo(0.5);
  expect(original.getAttribute('aria-hidden')).toBe('true');
  await press('selection-end-library');
  expect(Number(original.style.opacity)).toBe(1);
  expect(original.getAttribute('aria-hidden')).not.toBe('true');
  await press('main-tab-chats');
  expect(document.querySelector('[data-testid="main-tab-chats"]')?.getAttribute('aria-selected')).toBe('true');
});

it('keeps the navigation available while scrolling in either direction and after changing tabs', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<Host/>));
  const bar = () => document.querySelector('[data-testid="main-tab-bar"]')!;
  for (const action of ['down', 'little-up', 'up']) {
    await press(`scroll-library-${action}`);
    await act(async () => {await new Promise(resolve => setTimeout(resolve, 100));});
    expect(bar().getAttribute('aria-hidden')).not.toBe('true');
  }
  await press('main-tab-chats');
  expect(bar().getAttribute('aria-hidden')).not.toBe('true');
  expect(document.querySelector('[data-testid="main-tab-chats"]')?.getAttribute('aria-selected')).toBe('true');
});
