import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject} from 'react';
import {Animated, Easing, Platform, type LayoutRectangle, type ScrollView} from 'react-native';
import {animationBatch} from './animationBatch';
import {useReducedMotion} from './useReducedMotion';
import {messageSendDuration, messageSendLayout, sendRemaining, sendSamples, sendSqueeze} from './messageSendMotion';

type Flight = {id: string; phase: 'measuring' | 'flying'; composerHeight: number; oldOffset: number;
  width: number; height: number; bottom: number; travel: number;
  frozenRows: {id: string; layout: LayoutRectangle}[]};

/** Only explicit local sends animate. Restoring a room never replays its messages. */
export function useMessageSendMotion(scroll: RefObject<ScrollView | null>, reserve: number, textTop: number) {
  const reduced = useReducedMotion();
  const [flight, setFlight] = useState<Flight | null>(null);
  const active = useRef<Flight | null>(null);
  const dimensions = useRef({content: 0, viewport: 0, offset: 0});
  const row = useRef<LayoutRectangle | null>(null), bubble = useRef<LayoutRectangle | null>(null);
  const rowLayouts = useRef(new Map<string, LayoutRectangle>());
  const positioning = useRef<{flight: Flight; offset: number} | null>(null);
  const progress = useRef(new Animated.Value(1)).current;
  const historyDistance = useRef(new Animated.Value(0)).current;
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutFrame = useRef<number | null>(null);
  const remaining = useMemo(() => progress.interpolate({inputRange: sendSamples, outputRange: sendRemaining}), [progress]);
  const squeeze = useMemo(() => progress.interpolate({inputRange: sendSamples, outputRange: sendSqueeze}), [progress]);
  const historyY = useMemo(() => Animated.multiply(remaining, historyDistance), [remaining, historyDistance]);
  const ghostStyle = useMemo(() => flight ? {
    opacity: progress.interpolate({inputRange: [0, 0.09, 1], outputRange: [0, 1, 1]}),
    transform: [
      {translateX: Animated.multiply(squeeze, flight.width * 0.05 / 2)},
      {translateY: Animated.add(Animated.multiply(remaining, flight.travel), Animated.multiply(squeeze, flight.height * 0.02 / 2))},
      {scaleX: Animated.subtract(1, Animated.multiply(squeeze, 0.05))},
      {scaleY: Animated.subtract(1, Animated.multiply(squeeze, 0.02))},
    ],
  } : undefined, [flight, progress, remaining, squeeze]);
  const finish = useCallback(() => {
    if (layoutFrame.current !== null) cancelAnimationFrame(layoutFrame.current);
    layoutFrame.current = null;
    if (deadline.current) clearTimeout(deadline.current);
    deadline.current = null;
    active.current = null;
    positioning.current = null;
    progress.stopAnimation(); progress.setValue(1); historyDistance.setValue(0);
    setFlight(null);
  }, [progress, historyDistance]);
  useEffect(() => () => {
    if (deadline.current) clearTimeout(deadline.current);
    if (layoutFrame.current !== null) cancelAnimationFrame(layoutFrame.current);
    active.current = null; progress.stopAnimation();
  }, [progress]);
  useEffect(() => {if (reduced) finish();}, [reduced, finish]);

  function prepare(id: string, composerHeight: number) {
    finish();
    if (reduced || dimensions.current.viewport <= 0 || rowLayouts.current.size === 0) return;
    row.current = null; bubble.current = null;
    const {offset, viewport} = dimensions.current;
    const frozenRows = [...rowLayouts.current].filter(([, r]) => r.y + r.height > offset && r.y < offset + viewport)
      .map(([rowId, layout]) => ({id: rowId, layout: {...layout, y: layout.y - offset}}));
    const next: Flight = {id, phase: 'measuring', composerHeight, oldOffset: offset,
      width: 0, height: 0, bottom: 0, travel: 0, frozenRows};
    progress.setValue(0); active.current = next; setFlight(next);
    // Leave enough time for a busy Fabric commit and its native scroll event.
    // Missing layout (e.g. navigating away mid-commit) must never leave a message hidden.
    deadline.current = setTimeout(() => {finish(); scroll.current?.scrollToEnd({animated: false});}, 1000);
  }
  function startWhenMeasured() {
    if (layoutFrame.current !== null || active.current?.phase !== 'measuring' || positioning.current) return;
    // Fabric's layout event can precede the ScrollView's new native scroll range.
    // Keep the old rows still until that range is committed; otherwise the first
    // scroll is clamped and the compensating translation briefly moves them down.
    layoutFrame.current = requestAnimationFrame(() => {layoutFrame.current = null; start();});
  }
  function start() {
    const pending = active.current, r = row.current, b = bubble.current, d = dimensions.current;
    if (!pending || pending.phase !== 'measuring' || !r || !b || d.viewport <= 0) return;
    // Wait for both the new row and the compact composer padding, in either event order.
    if (Math.abs(d.content - (r.y + r.height + reserve + 12)) > 2) return;
    const layout = messageSendLayout({rowBottom: r.y + r.height, bubbleHeight: b.height,
      contentHeight: d.content, viewportHeight: d.viewport, oldOffset: pending.oldOffset,
      composerHeight: pending.composerHeight, textTop});
    // A very long message should remain a readable, clipped scroll row, not cover the header.
    if (b.height > d.viewport - reserve - 24) {finish(); scroll.current?.scrollToEnd({animated: false}); return;}
    const next: Flight = {...pending, phase: 'flying', width: b.width, height: b.height, bottom: layout.bottom, travel: layout.travel};
    positioning.current = {flight: next, offset: layout.offset};
    animationBatch(() => {
      // Moving the scroll offset and compensating the old rows happen together.
      historyDistance.setValue(Math.abs(layout.historyShift) < d.viewport ? layout.historyShift : 0);
      scroll.current?.scrollTo({y: layout.offset, animated: false});
    });
    if (Math.abs(d.offset - layout.offset) <= 1) revealPositioned();
  }
  function revealPositioned() {
    if (!positioning.current) return;
    if (deadline.current) clearTimeout(deadline.current);
    deadline.current = null;
    const next = positioning.current.flight;
    positioning.current = null; active.current = next; setFlight(next);
  }
  useLayoutEffect(() => {
    if (flight?.phase !== 'flying') return;
    const id = flight.id;
    const animation = Animated.timing(progress, {toValue: 1, duration: messageSendDuration,
      easing: Easing.linear, useNativeDriver: Platform.OS !== 'web'});
    animation.start(({finished}) => {if (finished && active.current?.id === id) finish();});
    return () => animation.stop();
  }, [flight, progress, finish]);

  return {flight, prepare, finish, historyY,
    isActive: () => !!active.current,
    onContentSize: (height: number) => {dimensions.current.content = height; startWhenMeasured();},
    onViewport: (height: number) => {
      if (active.current && Math.abs(dimensions.current.viewport - height) > 1) finish();
      dimensions.current.viewport = height; startWhenMeasured();
    },
    onScroll: (offset: number, viewport: number) => {
      if (active.current && Math.abs(dimensions.current.viewport - viewport) > 1) finish();
      dimensions.current.offset = offset; dimensions.current.viewport = viewport;
      if (positioning.current && Math.abs(positioning.current.offset - offset) <= 1) revealPositioned();
    },
    onRow: (id: string, value: LayoutRectangle) => {rowLayouts.current.set(id, value); if (active.current?.id === id) {row.current = value; startWhenMeasured();}},
    onBubble: (id: string, value: LayoutRectangle) => {if (active.current?.id === id) {bubble.current = value; startWhenMeasured();}},
    ghostStyle,
  };
}
