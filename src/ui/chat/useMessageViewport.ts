import {useCallback, useEffect, useLayoutEffect, useRef, type RefObject} from 'react';
import {Animated, Platform, type LayoutChangeEvent, type LayoutRectangle, type NativeScrollEvent, type NativeSyntheticEvent} from 'react-native';
import type {ChatRow} from '../../features/workspace/model';
import type {StoredMessage} from '../../ports/workspace';
import type {ScreenMemoryController} from '../ScreenController';
import type {RoomState, RoomView} from '../workspace/contracts';
import type {ScrollController} from '../workspace/useListScroll';
import {workspaceTuning as tuning} from '../workspace/tuning';
import {workspaceProbe} from '../workspace/probe';
import {ScrollEventEpoch} from '../workspace/ScrollEventEpoch';
import {usePlainScrollMemory} from '../usePlainScrollMemory';
import type {useMessageSendMotion} from '../useMessageSendMotion';
import type {useChatChrome} from '../useChatChrome';
import {groupedMessage} from '../chatConversation';
import {navigation} from '../tokens';
import {nativeMessageAnchoring} from './MessageList';

type Options = {memory: ScreenMemoryController; chat: ChatRow; room: RoomView | undefined; roomState: RoomState | null;
  scale: number; composerHeight: number; scroll: RefObject<ScrollController>;
  sending: ReturnType<typeof useMessageSendMotion>; chrome: ReturnType<typeof useChatChrome>};
/** Owns the visible anchor, bounded-history paging and native/desktop scroll corrections. */
export function useMessageViewport({memory, chat, room, roomState, scale, composerHeight, scroll, sending, chrome}: Options) {
  const scrolling = usePlainScrollMemory(memory, `chat:${chat.id}`, scroll);
  const savedScroll = memory.getScroll(`chat:${chat.id}`);
  // An explicitly remembered top position is different from an unopened room.
  const initialScroll = useRef(room ? !savedScroll.anchor : savedScroll.offset === 0 && savedScroll.maxOffset === 0);
  const followEnd = useRef(initialScroll.current);
  const scrollFrame = useRef({height: 0, content: 0, offset: savedScroll.offset});
  const cells = useRef(new Map<string, LayoutRectangle>());
  const rowHeights = useRef(new Map<string, number>());
  const anchor = useRef(savedScroll.anchor);
  const restoringAnchor = useRef(!!room && !!savedScroll.anchor);
  const previousMessages = useRef(chat.messages);
  const probeSettlesAt = useRef(0);
  const scrollEpoch = useRef(new ScrollEventEpoch());
  const anchorFrame = useRef<number | undefined>(undefined);
  const pendingAnchor = useRef<{offset: number; complete: boolean} | undefined>(undefined);
  useEffect(() => () => {if (anchorFrame.current !== undefined) cancelAnimationFrame(anchorFrame.current);}, []);
  const inspectRoom = useRef(() => ({} as Record<string, unknown>));
  inspectRoom.current = () => {
    const frame = scrollFrame.current, top = frame.offset + navigation.headerHeight * scale + 6;
    const bottom = Math.min(frame.content - composerHeight - 12, frame.offset + frame.height - composerHeight);
    let covered = 0, edge = top;
    const mounted = chat.messages.filter(row => workspaceProbe?.mounted.has(row.id));
    const visible: number[] = [];
    for (const row of mounted) {
      const layout = cells.current.get(row.id);
      if (!layout || layout.y + layout.height <= top || layout.y >= bottom) continue;
      visible.push((row as StoredMessage).sequence);
      const from = Math.max(top, layout.y), to = Math.min(bottom, layout.y + layout.height);
      covered += Math.max(0, to - Math.max(edge, from)); edge = Math.max(edge, to);
    }
    return {...frame, visible, mounted: mounted.length, mountedCharacters: mounted.reduce((sum, row) => sum + row.text.length, 0),
      missingPixels: Math.max(0, bottom - top - covered), bodyHeight: Math.max(0, bottom - top),
      loading: !!roomState?.loading, hasOlder: !!roomState?.hasOlder, hasNewer: !!roomState?.hasNewer,
      first: (chat.messages[0] as StoredMessage | undefined)?.sequence,
      last: (chat.messages.at(-1) as StoredMessage | undefined)?.sequence,
      restoring: restoringAnchor.current || initialScroll.current, driverSettling: performance.now() < probeSettlesAt.current};
  };
  useEffect(() => {
    const probe = workspaceProbe;
    if (!probe) return;
    const surface = {inspect: () => inspectRoom.current(), move: (pixels: number) => {
      // Absolute test commands must not overwrite an in-flight native prepend
      // correction. Real wheel/touch gestures stay entirely native and never pause.
      if (restoringAnchor.current || (nativeMessageAnchoring && performance.now() < probeSettlesAt.current)) return;
      const frame = scrollFrame.current;
      const y = Math.max(0, Math.min(frame.content - frame.height, frame.offset + pixels));
      scroll.current.scrollTo({y, animated: false});
    }};
    probe.surface = surface;
    return () => {if (probe.surface === surface) delete probe.surface;};
  }, [scroll]);
  useLayoutEffect(() => {
    const headChanged = chat.messages[0]?.id !== previousMessages.current[0]?.id;
    if (headChanged) workspaceProbe?.events?.push({name: 'window', time: performance.now(), first: chat.messages[0]?.id,
      anchor: {...anchor.current}, follow: followEnd.current, offset: scrollFrame.current.offset});
    // Prepend/eviction moves every row. Old coordinates belong to the previous
    // window and must never decide which of the new bodies should be evicted.
    if (headChanged) {cells.current.clear(); scrollEpoch.current.correct(performance.now());}
    const ids = new Set(chat.messages.map(message => message.id));
    for (const id of cells.current.keys()) if (!ids.has(id)) cells.current.delete(id);
    for (const id of rowHeights.current.keys()) if (!ids.has(id)) rowHeights.current.delete(id);
    sending.prune(ids);
    if (workspaceProbe && headChanged) probeSettlesAt.current = performance.now() + 100;
    // Native maintainVisibleContentPosition owns prepend/eviction anchoring.
    // A second scrollTo here interrupts the ongoing fling and moves it twice.
    if (!nativeMessageAnchoring && headChanged && !followEnd.current && anchor.current) restoringAnchor.current = true;
    previousMessages.current = chat.messages;
  }, [chat.messages]);
  const cellLayout = useRef<(id: string, layout: LayoutRectangle) => void>(() => {});
  function restoreMessageAnchor() {
    if (!restoringAnchor.current || !anchor.current) return;
    const frame = scrollFrame.current;
    if (!frame.height || !frame.content) return;
    // The anchor may temporarily sit outside FlatList's mounted range after a
    // prepend. Sum measured row heights to reach it without waiting for it to
    // mount (which itself needs the corrected scroll position).
    let y = navigation.headerHeight * scale + 6, found = false;
    for (let index = 0; index < chat.messages.length; index++) {
      const row = chat.messages[index]!;
      if (row.id === anchor.current.id) {found = true; break;}
      const intrinsic = rowHeights.current.get(row.id);
      if (intrinsic === undefined) return;
      y += intrinsic + (groupedMessage(chat.messages, index).before ? 3 : 16);
    }
    if (!found) return;
    const target = Math.max(0, y - anchor.current.offset);
    const maximum = Math.max(0, frame.content - frame.height), offset = Math.min(target, maximum);
    workspaceProbe?.events?.push({name: 'restore', time: performance.now(), id: anchor.current.id, y,
      anchorOffset: anchor.current.offset, target, maximum, offset});
    // Moving toward the anchor allows FlatList to measure its virtual tail.
    // Keep restoring until there is enough measured content to place it exactly.
    const complete = target <= maximum + 1 || !roomState?.hasNewer;
    if (!complete && !roomState?.loading && cells.current.has(chat.messages.at(-1)!.id)) void room?.newer();
    pendingAnchor.current = {offset, complete};
    if (anchorFrame.current === undefined) anchorFrame.current = requestAnimationFrame(() => {
      anchorFrame.current = undefined;
      const next = pendingAnchor.current;
      if (!next) return;
      // Layout notifications can arrive while native mounting still holds the
      // previous offset. Coalesce the rows and correct after that commit.
      scrollFrame.current.offset = next.offset;
      scrollEpoch.current.correct(performance.now());
      if (next.complete) restoringAnchor.current = false;
      scroll.current.scrollTo({y: next.offset, animated: false});
    });
  }
  cellLayout.current = (id, layout) => {
    cells.current.set(id, layout); sending.onRow(id, layout);
    const index = chat.messages.findIndex(message => message.id === id);
    if (index >= 0 && layout.height > 0) rowHeights.current.set(id, layout.height - (groupedMessage(chat.messages, index).before ? 3 : 16));
    if (initialScroll.current && id === chat.messages.at(-1)?.id) scroll.current.scrollToEnd({animated: false});
    if (restoringAnchor.current) restoreMessageAnchor();
  };
  const sendingViewport = useRef(sending.onViewport); sendingViewport.current = sending.onViewport;
  const updateChrome = chrome.updateGeometry;
  const updateViewport = useCallback((height: number) => {
    scrollFrame.current.height = height;
    sendingViewport.current(height);
    updateChrome(scrollFrame.current.offset, scrollFrame.current.content, height);
  }, [updateChrome]);
  const onScroll = Animated.event([{nativeEvent: {contentOffset: {y: chrome.scrollY}}}], {useNativeDriver: Platform.OS === 'ios' || Platform.OS === 'android', listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const {contentOffset, contentSize, layoutMeasurement} = event.nativeEvent;
    const now = performance.now(), timestamp = (event.nativeEvent as NativeScrollEvent & {timestamp?: number}).timestamp;
    const accepted = Platform.OS !== 'macos' || scrollEpoch.current.accepts(timestamp, now);
    if (!accepted) return;
    const height = scrollFrame.current.height || layoutMeasurement.height;
    if (!room) scrolling.onScroll({...event, nativeEvent: {...event.nativeEvent, layoutMeasurement: {...layoutMeasurement, height}}});
    else if (!restoringAnchor.current && !initialScroll.current) {
      const visible = chat.messages.filter(message => {const layout = cells.current.get(message.id);
        return layout && layout.y + layout.height > contentOffset.y && layout.y < contentOffset.y + height;});
      const first = visible[0] as StoredMessage | undefined;
      if (first) {
        anchor.current = {id: first.id, sequence: first.sequence, offset: cells.current.get(first.id)!.y - contentOffset.y};
        memory.rememberScroll(`chat:${chat.id}`, {offset: contentOffset.y, hidden: 0, height: 0, maxOffset: Math.max(0, contentSize.height - height), anchor: anchor.current});
        if (!sending.isActive()) room.retain(first.id, visible.at(-1)!.id);
        const delta = contentOffset.y - scrollFrame.current.offset;
        const head = cells.current.get(chat.messages[0]!.id), tail = cells.current.get(chat.messages.at(-1)!.id);
        // FlatList's estimated tail can end before unmeasured loaded rows.
        // Only the real loaded edge can request another database page.
        if (delta < -0.5 && head && contentOffset.y - head.y < height * tuning.prefetchScreens) void room.older();
        if (delta > 0.5 && tail && tail.y + tail.height - height - contentOffset.y < height * tuning.prefetchScreens) void room.newer();
      }
    }
    scrollFrame.current = {height, content: contentSize.height, offset: contentOffset.y};
    updateChrome(contentOffset.y, contentSize.height, height);
    sending.onScroll(contentOffset.y, height);
    if (initialScroll.current && contentSize.height > height && contentSize.height - height - contentOffset.y < 2) initialScroll.current = false;
    if (!initialScroll.current) followEnd.current = !roomState?.hasNewer && contentSize.height - height - contentOffset.y < 80;
  }});
  const onContentSizeChange = (width: number, height: number) => {
    if (!room) scrolling.onContentSizeChange(width, height);
    scrollFrame.current.content = height;
    restoreMessageAnchor();
    updateChrome(scrollFrame.current.offset, height, scrollFrame.current.height);
    sending.onContentSize(height);
    if (sending.isActive()) return;
    if (initialScroll.current || followEnd.current) {
      // Composer growth already supplies intermediate heights. Another
      // scroll animation here would make messages trail behind the input.
      scroll.current?.scrollToEnd({animated: false});
      // A tall desktop window or very short messages may need more than
      // one page before the first viewport is full.
      if (initialScroll.current && height <= scrollFrame.current.height && roomState?.hasOlder && !roomState.loading && cells.current.has(chat.messages.at(-1)!.id)) void room?.older();
    }
  };
  const onLayout = (event: LayoutChangeEvent) => {
    if (!room) scrolling.onLayout(event);
    // Mobile viewport changes are already anchored by the native keyboard
    // surface. A second JS scroll can use an intermediate IME frame.
    if (Platform.OS === 'web' && !sending.isActive() && followEnd.current) scroll.current?.scrollToEnd({animated: false});
  };
  return {scrolling, initialScroll, followEnd, cellLayout, updateViewport, onScroll, onContentSizeChange, onLayout};
}
