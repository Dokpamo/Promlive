// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {AccessibilityInfo, Animated, type ScrollView} from 'react-native';
import {afterEach, expect, it, vi} from 'vitest';
import {messageSendLayout, messageSendProgress, messageSendSqueeze} from '../src/ui/messageSendMotion';
import {useMessageSendMotion} from '../src/ui/useMessageSendMotion';
import {isBodyTap, isConversationEnd, useChatChrome} from '../src/ui/useChatChrome';
import {KeyboardViewport} from '../src/ui/chat-input/keyboardViewport';

vi.mock('react-native', async () => {
  const rn = await vi.importActual<typeof import('react-native')>('react-native-web');
  return {...rn, AccessibilityInfo: {isReduceMotionEnabled: async () => false, addEventListener: () => ({remove() {}})}};
});
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(async () => {if (root) await act(async () => root!.unmount()); root = undefined; vi.restoreAllMocks(); vi.useRealTimers(); document.body.replaceChildren();});

it('keeps the right and bottom scaling anchors fixed and settles after a small overshoot', () => {
  expect(messageSendProgress(0)).toBe(0); expect(messageSendProgress(1)).toBe(1);
  expect(messageSendProgress(0.7)).toBeGreaterThan(1);
  expect(messageSendProgress(0.7)).toBeLessThan(1.04);
  expect(messageSendSqueeze(2 / 7)).toBeCloseTo(1);
  for (const t of [0, 0.2, 0.4, 0.75, 1]) {
    const squeeze = messageSendSqueeze(t), width = 205, height = 72;
    expect(width * 0.05 / 2 * squeeze + width * (1 - 0.05 * squeeze) / 2).toBeCloseTo(width / 2);
    expect(height * 0.02 / 2 * squeeze + height * (1 - 0.02 * squeeze) / 2).toBeCloseTo(height / 2);
  }
});
it('lands above the composer with and without a keyboard, and does not scroll a short conversation', () => {
  const full = messageSendLayout({rowBottom: 900, bubbleHeight: 72, contentHeight: 1040, viewportHeight: 780, oldOffset: 220, composerHeight: 150, textTop: 14});
  const keyboard = messageSendLayout({rowBottom: 900, bubbleHeight: 72, contentHeight: 1040, viewportHeight: 440, oldOffset: 560, composerHeight: 150, textTop: 14});
  expect(full.bottom).toBe(140); expect(keyboard.bottom).toBe(full.bottom);
  expect(keyboard.travel).toBe(full.travel); expect(full.historyShift).toBe(40);
  const short = messageSendLayout({rowBottom: 220, bubbleHeight: 47, contentHeight: 360, viewportHeight: 780, oldOffset: 0, composerHeight: 128, textTop: 14});
  expect(short.offset).toBe(0); expect(short.historyShift).toBe(0); expect(short.bottom).toBe(560);
});
it('uses current body height at the end even if native scroll events still carry an earlier header or keyboard frame', () => {
  const viewport = new KeyboardViewport(), changed = vi.fn();
  const unsubscribe = viewport.subscribe(changed);
  viewport.dock(-320); viewport.layout(800);
  expect(viewport.read()).toBe(480);
  viewport.layout(864); expect(viewport.read()).toBe(544); // header collapsed
  viewport.dock(0); expect(viewport.read()).toBe(864);
  expect(isConversationEnd(500, 1364, viewport.read())).toBe(true);
  unsubscribe(); viewport.layout(800);
  expect(changed).toHaveBeenLastCalledWith(864);
});

async function harness() {
  const jobs: {complete: () => void}[] = [];
  vi.spyOn(Animated, 'timing').mockImplementation((value, config) => ({
    start: callback => {jobs.push({complete: () => {(value as Animated.Value).setValue(config.toValue as number); callback?.({finished: true});}});},
    stop() {}, reset() {},
  }));
  let motion!: ReturnType<typeof useMessageSendMotion>;
  const scrollTo = vi.fn(), scrollToEnd = vi.fn();
  const scroll = {current: {scrollTo, scrollToEnd} as unknown as ScrollView};
  function Harness() {motion = useMessageSendMotion(scroll, 128, 14); return null;}
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<Harness/>));
  await act(async () => {motion.onViewport(500); motion.onScroll(300, 500); motion.onRow('previous', {x: 14, y: 700, width: 380, height: 72});});
  const measure = (id: string) => {
    motion.onBubble(id, {x: 150, y: 0, width: 210, height: 72});
    motion.onRow(id, {x: 0, y: 788, width: 360, height: 72});
    motion.onContentSize(1000);
  };
  return {get motion() {return motion;}, jobs, measure, scrollTo, scrollToEnd};
}
const commitLayout = () => act(async () => {await new Promise(resolve => requestAnimationFrame(resolve));});
it('waits for the final layout, moves history with the new bubble, and ignores an interrupted send completion', async () => {
  const h = await harness();
  await act(async () => h.motion.prepare('first', 150));
  expect(h.motion.flight?.phase).toBe('measuring');
  await act(async () => h.measure('first'));
  await commitLayout();
  expect(h.motion.flight?.phase).toBe('measuring');
  await act(async () => h.motion.onScroll(500, 500));
  expect(h.motion.flight?.phase).toBe('flying');
  expect(h.scrollTo).toHaveBeenLastCalledWith({y: 500, animated: false});
  await act(async () => {h.motion.prepare('second', 128); h.measure('second');});
  await commitLayout();
  await act(async () => h.jobs[0]!.complete());
  expect(h.motion.flight?.id).toBe('second');
  await act(async () => h.jobs[1]!.complete());
  expect(h.motion.flight).toBeNull();
});
it('keeps the old rows still while a busy native layout and scroll event arrive', async () => {
  vi.useFakeTimers();
  const h = await harness();
  await act(async () => h.motion.prepare('busy', 150));
  expect(h.motion.flight?.frozenRows).toEqual([{id: 'previous', layout: {x: 14, y: 400, width: 380, height: 72}}]);
  await act(async () => vi.advanceTimersByTime(350));
  expect(h.motion.flight?.phase).toBe('measuring');
  await act(async () => h.measure('busy'));
  await act(async () => vi.advanceTimersByTime(20));
  expect(h.motion.flight?.phase).toBe('measuring');
  await act(async () => h.motion.onScroll(500, 500));
  expect(h.motion.flight?.phase).toBe('flying');
  await act(async () => h.jobs[0]!.complete());
  expect(h.motion.flight).toBeNull();
});
it('reveals the real message if layout never arrives, the viewport changes, or motion is reduced', async () => {
  vi.useFakeTimers();
  const h = await harness();
  await act(async () => h.motion.prepare('missing', 150));
  await act(async () => vi.advanceTimersByTime(1001));
  expect(h.motion.flight).toBeNull();
  await act(async () => {h.motion.prepare('resized', 150); h.measure('resized');});
  await act(async () => vi.advanceTimersByTime(20));
  await act(async () => h.motion.onViewport(320));
  expect(h.motion.flight).toBeNull();
  await act(async () => root!.unmount()); root = undefined;
  vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  const reduced = await harness();
  await act(async () => reduced.motion.prepare('accessible', 150));
  expect(reduced.motion.flight).toBeNull();
});

it('hides both controls in history, keeps the composer at the end, and restores both on a second tap', async () => {
  let chrome!: ReturnType<typeof useChatChrome>;
  const tap = vi.fn();
  function Harness() {chrome = useChatChrome(tap); return null;}
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<Harness/>));
  const bodyTap = () => {
    const e = {nativeEvent: {pageX: 150, pageY: 200}};
    chrome.touchHandlers.onPointerDown!(e); chrome.touchHandlers.onPointerUp!(e);
  };
  await act(async () => {chrome.setAtEnd(false); bodyTap();});
  expect(chrome.hidden).toBe(true); expect(chrome.composerHidden).toBe(true);
  await act(async () => chrome.setAtEnd(true));
  expect(chrome.hidden).toBe(true); expect(chrome.composerHidden).toBe(false);
  await act(async () => bodyTap());
  expect(chrome.hidden).toBe(false); expect(chrome.composerHidden).toBe(false);
  expect(tap).toHaveBeenCalledTimes(2);
  expect(isConversationEnd(397, 1000, 600)).toBe(true);
  expect(isConversationEnd(390, 1000, 600)).toBe(false);
  const start = {x: 10, y: 20, at: 0};
  expect(isBodyTap(start, 10, 20, 500)).toBe(false); // text selection
  expect(isBodyTap(start, 10, 90, 120)).toBe(false); // scroll
});
