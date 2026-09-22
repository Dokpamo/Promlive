// @vitest-environment jsdom
import {act, type ReactNode, type Ref} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {usePanelMotion} from '../src/features/chat/usePanelMotion';
import {useComposerPull} from '../src/features/chat/useComposerPull';
import {SwipeBackModal, SwipeBackScrollContent} from '../src/layout/SwipeBackModal';
import {useSettingsSheetState} from '../src/features/settings/useSettingsSheetState';
import type {Animated, GestureResponderEvent, PanResponderCallbacks, PanResponderGestureState} from 'react-native';

// Model native animation positions separately from JS listeners, including
// delayed stop/read responses and completion callbacks already in flight.
const native = vi.hoisted(() => {
  const reads: (() => void)[] = [];
  const values: Value[] = [];
  const springs: {value: Value; target: number; finish: (finished?: boolean) => void}[] = [];
  class Value {
    displayed: number;
    listeners = new Map<string, (event: {value: number}) => void>();
    stopCurrent: (() => void) | undefined;
    constructor(value: number) {this.displayed = value; values.push(this);}
    setValue(value: number) {this.displayed = value; for (const listener of this.listeners.values()) listener({value});}
    addListener(listener: (event: {value: number}) => void) {const id = String(this.listeners.size); this.listeners.set(id, listener); return id;}
    removeListener(id: string) {this.listeners.delete(id);}
    stopAnimation(done?: (value: number) => void) {
      this.stopCurrent?.(); this.stopCurrent = undefined;
      const value = this.displayed;
      if (done) reads.push(() => done(value));
    }
    interpolate() {return {};}
  }
  function spring(value: Value, options: {toValue: number}) {
    let callback: ((result: {finished: boolean}) => void) | undefined;
    const record = {value, target: options.toValue, finish: (finished = true) => callback?.({finished})};
    springs.push(record);
    return {
      start(done?: typeof callback) {callback = done; value.stopCurrent = () => done?.({finished: false});},
      stop() {callback?.({finished: false});},
    };
  }
  return {Value, values, springs, spring, reads, pans: [] as PanResponderCallbacks[], touchUpdates: [] as {index: number | undefined; pointerEvents: string}[], scrollStart: undefined as (() => boolean) | undefined, requestClose: undefined as (() => void) | undefined, flush: () => {while (reads.length) reads.shift()!();}};
});

vi.mock('react-native', async () => {
  const React = await import('react');
  const View = ({children, testID, pointerEvents, mockPanIndex, onStartShouldSetResponder, ref}: {children?: ReactNode; testID?: string; pointerEvents?: string; mockPanIndex?: number; onStartShouldSetResponder?: () => boolean; ref?: Ref<{setNativeProps: (props: {pointerEvents: string}) => void}>}) => {
    React.useImperativeHandle(ref, () => ({setNativeProps: props => native.touchUpdates.push({index: mockPanIndex, pointerEvents: props.pointerEvents})}), [mockPanIndex]);
    if (onStartShouldSetResponder) native.scrollStart = onStartShouldSetResponder;
    return <div data-testid={testID} data-pointer-events={pointerEvents} data-pan-index={mockPanIndex}>{children}</div>;
  };
  return {
    View, Platform: {OS: 'android'}, Keyboard: {dismiss: vi.fn()},
    AccessibilityInfo: {isReduceMotionEnabled: async () => false, addEventListener: () => ({remove() {}})},
    Modal: ({children, onShow, onRequestClose}: {children: ReactNode; onShow: () => void; onRequestClose: () => void}) => {React.useEffect(onShow, []); native.requestClose = onRequestClose; return <div data-testid="native-modal">{children}</div>;},
    StyleSheet: {create: (styles: unknown) => styles, absoluteFill: {}, absoluteFillObject: {}},
    useWindowDimensions: () => ({width: 400, height: 800}),
    PanResponder: {create: (callbacks: PanResponderCallbacks) => {native.pans.push(callbacks); return {panHandlers: {mockPanIndex: native.pans.length - 1}};}},
    Animated: {
      Value: native.Value, View, spring: native.spring,
      multiply: () => ({}), subtract: () => ({}),
      parallel: (animations: ReturnType<typeof native.spring>[]) => ({
        start(done: (result: {finished: boolean}) => void) {
          let remaining = animations.length, finished = true;
          animations.forEach(animation => animation.start(result => {finished &&= result.finished; if (--remaining === 0) done({finished});}));
        },
      }),
    },
  };
});
vi.mock('react-native-safe-area-context', () => ({SafeAreaProvider: ({children}: {children: ReactNode}) => children}));
vi.mock('../src/layout/selectionHaptic', () => ({selectionHaptic: vi.fn()}));
vi.mock('../src/layout/useScreenCorners', () => ({useScreenCorners: () => ({topLeft: 24, topRight: 24, bottomLeft: 24, bottomRight: 24})}));
vi.mock('../src/features/appearance/AppAppearance', () => ({useAppearance: () => ({isDark: false}), syncSystemBars: vi.fn()}));

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
async function render(child: ReactNode) {
  if (!root) {const container = document.createElement('div'); document.body.append(container); root = createRoot(container);}
  await act(async () => root!.render(child));
}
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  native.reads.length = 0; native.values.length = 0; native.springs.length = 0; native.pans.length = 0;
  native.touchUpdates.length = 0;
  native.requestClose = undefined;
  native.scrollStart = undefined;
  document.body.replaceChildren();
});
const event = {} as GestureResponderEvent;
function gesture(dx = 0, dy = 0, vx = 0, vy = 0): PanResponderGestureState {
  return {dx, dy, vx, vy, numberActiveTouches: 1} as PanResponderGestureState;
}
const pan = () => native.pans[native.pans.length - 1]!;
const renderedPan = (testID: string) => native.pans[Number(document.querySelector(`[data-testid="${testID}"]`)!.getAttribute('data-pan-index'))]!;
function touchDown() {
  pan().onStartShouldSetPanResponderCapture!(event, gesture());
  expect(pan().onStartShouldSetPanResponder!(event, gesture())).toBe(true);
  pan().onPanResponderGrant!(event, gesture());
}

it('regrabs a moving navigation panel at its displayed position, including motion before capture', async () => {
  let panel!: ReturnType<typeof usePanelMotion>;
  function Host() {panel = usePanelMotion(false, 400); return null;}
  await render(<Host/>);
  await act(async () => panel.settle(true));
  native.values[0]!.displayed = 0.6; // Native moved; JS listener still says zero.
  await act(async () => {panel.begin(0.03); panel.move(-0.1); native.flush();});
  expect(panel.position.current).toBeCloseTo(0.53);
  await act(async () => panel.move(-0.2));
  expect(panel.position.current).toBeCloseTo(0.43);
  await act(async () => panel.release(-0.2, -0.7));
  expect(panel.target.current).toBe(false);
});

it('moves and releases immediately without waiting for a delayed native position callback', async () => {
  let panel!: ReturnType<typeof usePanelMotion>;
  function Host() {panel = usePanelMotion(false, 400); return null;}
  await render(<Host/>);
  native.values[0]!.setValue(0.2);
  await act(async () => {panel.begin(); panel.move(0.15);});
  expect(panel.position.current).toBeCloseTo(0.35);
  await act(async () => panel.release(0.15, 0.8));
  expect(panel.target.current).toBe(true);
  await act(async () => native.flush());
  expect(panel.target.current).toBe(true);
  expect(native.springs.at(-1)?.target).toBe(1);
});

it('does not hide a regrabbed panel when its previous closing callback arrives late', async () => {
  let panel!: ReturnType<typeof usePanelMotion>;
  function Host() {panel = usePanelMotion(false, 400); return null;}
  await render(<Host/>);
  await act(async () => {panel.settle(true); panel.settle(false);});
  const closing = native.springs.at(-1)!;
  native.values[0]!.displayed = 0.4;
  await act(async () => {panel.begin(); native.flush(); panel.move(0.1); closing.finish();});
  expect(panel.visible).toBe(true);
  expect(panel.position.current).toBeCloseTo(0.5);
  await act(async () => {panel.reset(); native.flush();});
  expect(panel.visible).toBe(false);
});

it('ignores an old native grab response after resetting navigation', async () => {
  let panel!: ReturnType<typeof usePanelMotion>;
  function Host() {panel = usePanelMotion(false, 400); return null;}
  await render(<Host/>);
  native.values[0]!.displayed = 0.7;
  await act(async () => {panel.begin(); panel.move(0.1); panel.reset(); native.flush();});
  expect(panel.position.current).toBe(0);
  expect(panel.visible).toBe(false);
});

it('allows grabbing a settings sheet before its entrance finishes', async () => {
  const close = vi.fn();
  await render(<SwipeBackModal sheet sheetHeight={400} onClose={close}>{() => null}</SwipeBackModal>);
  native.values[0]!.displayed = 0.25;
  await act(async () => {touchDown(); native.flush(); pan().onPanResponderMove!(event, gesture(0, 40));});
  expect(native.values[0]!.displayed).toBeCloseTo(0.35);
  expect(close).not.toHaveBeenCalled();
});

it('moves a settings sheet while its native position read is still pending', async () => {
  await render(<SwipeBackModal sheet sheetHeight={400} onClose={vi.fn()}>{() => null}</SwipeBackModal>);
  native.values[0]!.setValue(0.2);
  await act(async () => {touchDown(); pan().onPanResponderMove!(event, gesture(0, 40));});
  expect(native.reads.length).toBe(3);
  expect(native.values[0]!.displayed).toBeCloseTo(0.3);
  await act(async () => native.flush());
  expect(native.values[0]!.displayed).toBeCloseTo(0.3);
});

it('reverses a closing settings page without being removed by its stale completion', async () => {
  const close = vi.fn();
  let dismiss!: () => void;
  await render(<SwipeBackModal onClose={close}>{done => {dismiss = done; return null;}}</SwipeBackModal>);
  await act(async () => dismiss());
  const previous = native.springs.at(-1)!;
  native.values[0]!.displayed = 0.45;
  await act(async () => {
    touchDown(); native.flush();
    pan().onPanResponderMove!(event, gesture(-80));
    pan().onPanResponderRelease!(event, gesture(-80, 0, -0.8));
    previous.finish();
  });
  expect(native.springs.at(-1)?.target).toBe(0);
  expect(close).not.toHaveBeenCalled();
});

it('keeps an inactive settings page out of gestures owned by its child popup', async () => {
  await render(<SwipeBackModal active={false} onClose={vi.fn()}>{() => null}</SwipeBackModal>);
  expect(pan().onStartShouldSetPanResponder!(event, gesture())).toBe(false);
  expect(pan().onMoveShouldSetPanResponderCapture!(event, gesture(150))).toBe(false);
});

it.each(['button', 'swipe'])('hands the next back gesture to settings as soon as a detail page exits via %s', async source => {
  const closeSettings = vi.fn(), closeDetail = vi.fn();
  let dismissDetail!: () => void;
  await render(<SwipeBackModal onClose={closeSettings}>{() =>
    <SwipeBackModal onClose={closeDetail}>{dismiss => {dismissDetail = dismiss; return null;}}</SwipeBackModal>
  }</SwipeBackModal>);
  expect(document.querySelectorAll('[data-testid="native-modal"]')).toHaveLength(1);
  const pages = document.querySelectorAll('[data-testid="settings-back-swipe"]');
  const parentPan = native.pans[Number(pages[0]!.getAttribute('data-pan-index'))]!;
  const detailPan = native.pans[Number(pages[1]!.getAttribute('data-pan-index'))]!;
  native.values[0]!.setValue(0); native.values[3]!.setValue(0);
  expect(parentPan.onStartShouldSetPanResponder!(event, gesture())).toBe(false);
  await act(async () => {
    if (source === 'button') dismissDetail();
    else {
      detailPan.onStartShouldSetPanResponderCapture!(event, gesture());
      detailPan.onPanResponderGrant!(event, gesture());
      native.flush();
      detailPan.onPanResponderMove!(event, gesture(160));
      detailPan.onPanResponderRelease!(event, gesture(160, 0, 0.8));
    }
    expect(detailPan.onMoveShouldSetPanResponderCapture!(event, gesture(30))).toBe(false);
    expect(native.touchUpdates.at(-1)).toEqual({index: Number(pages[1]!.getAttribute('data-pan-index')), pointerEvents: 'none'});
    // The parent's next DOWN may arrive before React commits the outgoing view update.
    parentPan.onStartShouldSetPanResponderCapture!(event, gesture());
    expect(parentPan.onMoveShouldSetPanResponderCapture!(event, gesture(20))).toBe(true);
    parentPan.onPanResponderGrant!(event, gesture());
    expect(parentPan.onShouldBlockNativeResponder!(event, gesture())).toBe(true);
    native.flush();
    parentPan.onPanResponderMove!(event, gesture(160));
    parentPan.onPanResponderRelease!(event, gesture(160, 0, 0.8));
  });
  expect(closeDetail).not.toHaveBeenCalled();
  expect(closeSettings).not.toHaveBeenCalled();
  expect(pages[1]!.getAttribute('data-pointer-events')).toBe('none');
  const parentExit = native.springs.at(-1)!;
  expect(parentExit.value).toBe(native.values[0]);
  expect(parentExit.target).toBe(1);
  await act(async () => detailPan.onPanResponderTerminate!(event, gesture()));
  expect(native.springs.at(-1)).toBe(parentExit);
});

it('routes consecutive Android back presses through a sheet, detail and settings without waiting for springs', async () => {
  const closeSettings = vi.fn(), closeDetail = vi.fn(), closeSheet = vi.fn();
  await render(<SwipeBackModal onClose={closeSettings}>{() =>
    <SwipeBackModal onClose={closeDetail}>{() =>
      <SwipeBackModal sheet sheetHeight={400} onClose={closeSheet}>{() => null}</SwipeBackModal>
    }</SwipeBackModal>
  }</SwipeBackModal>);
  expect(document.querySelectorAll('[data-testid="native-modal"]')).toHaveLength(1);
  await act(async () => native.requestClose!());
  expect(native.springs.at(-3)?.value).toBe(native.values[6]);
  const sheetExit = native.springs.slice(-3);
  await act(async () => native.requestClose!());
  const detailExit = native.springs.at(-1)!;
  expect(detailExit.value).toBe(native.values[3]);
  expect(detailExit.target).toBe(1);
  await act(async () => native.requestClose!());
  const settingsExit = native.springs.at(-1)!;
  expect(settingsExit.value).toBe(native.values[0]);
  expect(settingsExit.target).toBe(1);
  await act(async () => {sheetExit.forEach(spring => spring.finish()); detailExit.finish(); settingsExit.finish();});
  expect(closeSheet).toHaveBeenCalledOnce();
  expect(closeDetail).toHaveBeenCalledOnce();
  expect(closeSettings).toHaveBeenCalledOnce();
});

it('hands the next back swipe to the page as soon as a sheet closes, before its exit animation finishes', async () => {
  const closePage = vi.fn(), closeSheet = vi.fn();
  let dismissSheet!: () => void;
  await render(<SwipeBackModal onClose={closePage}>{() =>
    <SwipeBackModal sheet sheetHeight={400} onClose={closeSheet}>{dismiss => {dismissSheet = dismiss; return null;}}</SwipeBackModal>
  }</SwipeBackModal>);
  // A separate native dialog would still intercept the touch despite pointerEvents="none".
  expect(document.querySelectorAll('[data-testid="native-modal"]')).toHaveLength(1);
  const pagePan = renderedPan('settings-back-swipe');
  expect(pagePan.onStartShouldSetPanResponder!(event, gesture())).toBe(false);
  expect(pagePan.onMoveShouldSetPanResponderCapture!(event, gesture(150))).toBe(false);
  native.values[0]!.setValue(0);
  await act(async () => dismissSheet());
  const sheetExit = native.springs.slice(-3);
  expect(closeSheet).not.toHaveBeenCalled();
  expect(document.querySelector('[data-testid="settings-sheet-swipe"]')!.getAttribute('data-pointer-events')).toBe('none');
  expect(renderedPan('settings-sheet-swipe').onStartShouldSetPanResponder!(event, gesture())).toBe(false);
  await act(async () => {
    pagePan.onStartShouldSetPanResponderCapture!(event, gesture());
    expect(pagePan.onMoveShouldSetPanResponderCapture!(event, gesture(20))).toBe(true);
    pagePan.onPanResponderGrant!(event, gesture());
    expect(pagePan.onShouldBlockNativeResponder!(event, gesture())).toBe(true);
    native.flush();
    pagePan.onPanResponderMove!(event, gesture(160));
    pagePan.onPanResponderRelease!(event, gesture(160, 0, 0.8));
  });
  expect(native.values[0]!.displayed).toBeCloseTo(0.45);
  const pageExit = native.springs.at(-1)!;
  expect(pageExit.target).toBe(1);
  // A late responder cancellation must not reopen a sheet already dismissed by a choice.
  await act(async () => renderedPan('settings-sheet-swipe').onPanResponderTerminate!(event, gesture()));
  expect(native.springs.at(-1)).toBe(pageExit);
  await act(async () => {sheetExit.forEach(spring => spring.finish()); pageExit.finish();});
  expect(closeSheet).toHaveBeenCalledOnce();
  expect(closePage).toHaveBeenCalledOnce();
});

it('keeps native scrolling available when no sheet is handing off a touch', async () => {
  await render(<SwipeBackModal onClose={vi.fn()}>{() => null}</SwipeBackModal>);
  await act(async () => touchDown());
  expect(pan().onShouldBlockNativeResponder!(event, gesture())).toBe(false);
});

it('routes Android back to the open sheet, then to the page during the sheet exit', async () => {
  const closePage = vi.fn(), closeSheet = vi.fn();
  await render(<SwipeBackModal onClose={closePage}>{() =>
    <SwipeBackModal sheet sheetHeight={400} onClose={closeSheet}>{() => null}</SwipeBackModal>
  }</SwipeBackModal>);
  await act(async () => native.requestClose!());
  expect(native.springs.at(-3)?.value).toBe(native.values[3]);
  expect(native.springs.at(-3)?.target).toBe(1);
  await act(async () => native.requestClose!());
  expect(native.springs.at(-1)?.value).toBe(native.values[0]);
  expect(native.springs.at(-1)?.target).toBe(1);
  expect(closePage).not.toHaveBeenCalled();
  expect(closeSheet).not.toHaveBeenCalled();
});

it('routes back through nested sheets and lets the editor hide its keyboard first', async () => {
  const closePage = vi.fn(), closeChoices = vi.fn(), closeEditor = vi.fn();
  let keyboardVisible = true;
  const hideKeyboard = vi.fn(() => {const visible = keyboardVisible; keyboardVisible = false; return visible;});
  await render(<SwipeBackModal onClose={closePage}>{() =>
    <SwipeBackModal sheet sheetHeight={400} onClose={closeChoices}>{() =>
      <SwipeBackModal sheet sheetHeight={700} onClose={closeEditor} onBackRequest={hideKeyboard}>{() => null}</SwipeBackModal>
    }</SwipeBackModal>
  }</SwipeBackModal>);
  const count = native.springs.length;
  await act(async () => native.requestClose!());
  expect(hideKeyboard).toHaveBeenCalledTimes(1);
  expect(native.springs).toHaveLength(count);
  await act(async () => native.requestClose!());
  const editorExit = native.springs.slice(-3);
  await act(async () => editorExit.forEach(spring => spring.finish()));
  expect(closeEditor).toHaveBeenCalledTimes(1);
  expect(closeChoices).not.toHaveBeenCalled();
  expect(closePage).not.toHaveBeenCalled();
  await act(async () => native.requestClose!());
  await act(async () => native.springs.slice(-3).forEach(spring => spring.finish()));
  expect(closeChoices).toHaveBeenCalledTimes(1);
  expect(closePage).not.toHaveBeenCalled();
});

it('releases the closing sheet scroll responder before the next native view update', async () => {
  let dismiss!: () => void;
  await render(<SwipeBackModal sheet sheetHeight={400} onClose={vi.fn()}>{close => {
    dismiss = close;
    return <SwipeBackScrollContent sheetScroll={{current: {canScroll: true, offset: 0}}}>choices</SwipeBackScrollContent>;
  }}</SwipeBackModal>);
  const oldScrollStart = native.scrollStart!;
  expect(oldScrollStart()).toBe(true);
  await act(async () => {
    dismiss();
    // Native can deliver the next DOWN while the outgoing view is still mounted.
    expect(oldScrollStart()).toBe(false);
  });
});

it.each(['choice', 'drag'])('stops native sheet scrolling before the %s exit spring starts', async source => {
  const onClose = vi.fn();
  const prepare = vi.fn(() => expect(native.springs.at(-3)?.target).toBe(0));
  let dismiss!: () => void;
  await render(<SwipeBackModal sheet sheetHeight={400} onClose={onClose} onDismissStart={prepare}>{close => {dismiss = close; return null;}}</SwipeBackModal>);
  native.values[0]!.setValue(0);
  await act(async () => {
    if (source === 'choice') dismiss();
    else {
      touchDown(); native.flush();
      pan().onPanResponderMove!(event, gesture(0, 180));
      pan().onPanResponderRelease!(event, gesture(0, 180, 0, 0.8));
    }
    dismiss();
  });
  expect(prepare).toHaveBeenCalledOnce();
  expect(native.springs.at(-3)?.target).toBe(1);
  expect(onClose).not.toHaveBeenCalled();
});

it.each(['theme', 'display'])('can immediately reopen %s without the previous dismissal closing it', async next => {
  let state!: ReturnType<typeof useSettingsSheetState<string>>;
  let dismiss!: () => void;
  function Host() {
    state = useSettingsSheetState<string>();
    return <SwipeBackModal onClose={vi.fn()}>{() => state.sheet !== null &&
      <SwipeBackModal key={state.sheetKey} sheet sheetHeight={400} onClose={state.closeSheet}>{close => {dismiss = close; return null;}}</SwipeBackModal>
    }</SwipeBackModal>;
  }
  await render(<Host/>);
  await act(async () => state.setSheet('theme'));
  const previousClose = state.closeSheet, previousKey = state.sheetKey;
  await act(async () => dismiss());
  const previousExit = native.springs.slice(-3);
  await act(async () => {state.setSheet(next); previousClose();});
  expect(state.sheet).toBe(next);
  expect(state.sheetKey).not.toBe(previousKey);
  await act(async () => previousExit.forEach(spring => spring.finish()));
  expect(state.sheet).toBe(next);
  expect(document.querySelector('[data-testid="settings-sheet-swipe"]')!.getAttribute('data-pointer-events')).toBe('auto');
  expect(renderedPan('settings-back-swipe').onStartShouldSetPanResponder!(event, gesture())).toBe(false);
});

it.each(['ai', 'theme'])('keeps a newly opened %s page when the previous detail exit completes late', async next => {
  let state!: ReturnType<typeof useSettingsSheetState<string>>;
  let dismiss!: () => void;
  function Host() {
    state = useSettingsSheetState<string>();
    return <SwipeBackModal onClose={vi.fn()}>{() => state.sheet !== null &&
      <SwipeBackModal key={state.sheetKey} onClose={state.closeSheet}>{close => {dismiss = close; return null;}}</SwipeBackModal>
    }</SwipeBackModal>;
  }
  await render(<Host/>);
  await act(async () => state.setSheet('ai'));
  const previousClose = state.closeSheet, previousKey = state.sheetKey;
  await act(async () => dismiss());
  const previousExit = native.springs.at(-1)!;
  await act(async () => {state.setSheet(next); previousClose();});
  await act(async () => previousExit.finish());
  expect(state.sheet).toBe(next);
  expect(state.sheetKey).not.toBe(previousKey);
  const pages = document.querySelectorAll('[data-testid="settings-back-swipe"]');
  expect(pages).toHaveLength(2);
  expect(pages[1]!.getAttribute('data-pointer-events')).toBe('auto');
  expect(renderedPan('settings-back-swipe').onStartShouldSetPanResponder!(event, gesture())).toBe(false);
  expect(document.querySelectorAll('[data-testid="native-modal"]')).toHaveLength(1);
});

it('regrabs composer recovery immediately while preserving the text gesture boundary', async () => {
  const x = new native.Value(0), y = new native.Value(0);
  const grab = vi.fn(), restore = vi.fn(), close = vi.fn();
  let pull!: ReturnType<typeof useComposerPull>;
  function Host() {pull = useComposerPull({x, y} as unknown as {x: Animated.Value; y: Animated.Value}, {travel: 700, ready: () => true, grab, restore, close}); return null;}
  await render(<Host/>);
  await act(async () => {
    touchDown();
    pan().onPanResponderMove!(event, gesture(0, 80));
    pan().onPanResponderRelease!(event, gesture(0, 80));
  });
  expect(restore).toHaveBeenCalledOnce();
  y.setValue(60); // Midway through the return spring.
  await act(async () => {touchDown(); pan().onPanResponderMove!(event, gesture(0, 30));});
  expect(grab).toHaveBeenCalledTimes(2);
  expect(y.displayed).toBe(90);
  pan().onStartShouldSetPanResponderCapture!(event, gesture()); pull.blockInput();
  expect(pan().onStartShouldSetPanResponder!(event, gesture())).toBe(false);
  expect(pan().onMoveShouldSetPanResponderCapture!(event, gesture(0, 80))).toBe(false);
  expect(close).not.toHaveBeenCalled();
});
