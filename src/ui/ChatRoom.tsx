import {usePalette, themedStyles} from './Theme';
import {createContext, createRef, forwardRef, memo, useContext, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject} from 'react';
import {Animated, BackHandler, Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type FlatList, type FlatListProps, type LayoutChangeEvent, type LayoutRectangle, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {ChatRow} from './screenState';
import type {ScreenMemoryController as ScreenMemory} from './ScreenMemory';
import type {GalleryImage} from './cardDetails';
import type {BackTransition} from './backTransition';
import type {GestureBlockRef} from './HorizontalGesture.types';
import {SwipeBack} from './SwipeBack';
import {NavigationButton} from './Navigation';
import {ChatInput} from './chat-input/ChatInput';
import {ChatKeyboardProvider, ChatKeyboardBody, ChatKeyboardDock, dismissChatKeyboard} from './chat-input/KeyboardDock';
import {PreviewArtwork} from './PreviewArtwork';
import {navigation, navigationActionMetrics} from './tokens';
import {inputLayout, inputMetrics} from './chat-input/geometry';
import {groupedMessage, type ChatMessage} from './chatConversation';
import {usePlainScrollMemory} from './usePlainScrollMemory';
import {useMessageSendMotion} from './useMessageSendMotion';
import {useChatChrome} from './useChatChrome';
import {useDesktopPane} from './desktop/DesktopPane';
import {desktopMetrics} from './desktop/desktopMetrics';
import {useWorkspaceRoom} from './workspace/hooks';
import {useListScroll} from './workspace/useListScroll';
import {workspaceTuning as tuning} from './workspace/tuning';
import type {StoredMessage} from './workspace/types';
import {workspaceProbe} from './workspace/probe';
import {ScrollEventEpoch} from './workspace/ScrollEventEpoch';

const CellLayout = createContext<MutableRefObject<(id: string, layout: LayoutRectangle) => void> | null>(null);
const nativeMessageAnchoring = Platform.OS === 'ios' || Platform.OS === 'android';
function ManualAnchorScroll({maintainVisibleContentPosition: _position, ...props}: ScrollViewProps) {
  return <ScrollView {...props}/>;
}
type MessageCellProps = {children?: import('react').ReactNode; item: ChatMessage; onLayout?: ((event: LayoutChangeEvent) => void) | undefined; style?: import('react-native').StyleProp<import('react-native').ViewStyle>};
function MessageCell({children, item, onLayout, style}: MessageCellProps) {
  const layout = useContext(CellLayout);
  const ref = useRef<View>(null);
  useEffect(() => {
    const probe = workspaceProbe;
    if (!probe) return;
    probe.mounted.add(item.id);
    return () => {probe.mounted.delete(item.id);};
  }, [item.id]);
  useLayoutEffect(() => {
    // RN Web's ResizeObserver reports size, not a same-sized cell moving after
    // a prepend. Read its new parent-relative position once after the commit.
    if (nativeMessageAnchoring) return;
    ref.current?.measure((x, y, width, height) => layout?.current(item.id, {x, y, width, height}));
  });
  return <View ref={ref} style={style} onLayout={event => {onLayout?.(event); layout?.current(item.id, event.nativeEvent.layout);}}>{children}</View>;
}

// The storage window already bounds message bodies. On iOS a second virtual
// window can temporarily replace the native anchor with a spacer during a fling.
// Keep this small window mounted so UIKit can anchor the actual message view.
const BoundedMessageList = forwardRef<FlatList<ChatMessage>, Omit<FlatListProps<ChatMessage>, 'data'> & {data: readonly ChatMessage[]}>(function BoundedMessageList({
  data, renderItem, keyExtractor, CellRendererComponent: _cell, initialNumToRender: _initial,
  maxToRenderPerBatch: _batch, windowSize: _window, renderScrollComponent: _renderScroll, ...props
}, ref) {
  const native = useRef<ScrollView>(null);
  useImperativeHandle(ref, () => ({
    scrollToOffset: ({offset, animated}: {offset: number; animated?: boolean}) => native.current?.scrollTo({y: offset, animated}),
    scrollToEnd: (options?: {animated?: boolean}) => native.current?.scrollToEnd(options),
    getScrollResponder: () => native.current,
  }) as FlatList<ChatMessage>, []);
  return <Animated.ScrollView {...props} ref={native}>
    {data?.map((item, index) => <MessageCell key={keyExtractor?.(item, index) ?? item.id} item={item}>
      {renderItem?.({item, index, separators: {highlight() {}, unhighlight() {}, updateProps() {}}})}
    </MessageCell>)}
  </Animated.ScrollView>;
});

type Props = {chat: ChatRow; gallery: GalleryImage[]; memory: ScreenMemory; scale: number; onClose: () => void; transition: BackTransition};
export function ChatRoom(p: Props) {
  const [panelOpen, setPanelOpen] = useState(false);
  const blockers = useMemo(() => [createRef() as GestureBlockRef], []);
  const close = useCallback(() => {dismissChatKeyboard(); p.onClose();}, [p.onClose]);
  return <SwipeBack identity={p.chat.id} onBack={close} enabled={!panelOpen} blockers={blockers} transition={p.transition} drawBehindStatusBar>
    <ChatKeyboardProvider><ChatRoomContent {...p} onClose={close} blocker={blockers[0]!} onPanelChange={setPanelOpen}/></ChatKeyboardProvider>
  </SwipeBack>;
}
function ChatRoomContent({chat: fallback, gallery, memory, scale, onClose, blocker, onPanelChange}: Props & {
  blocker: GestureBlockRef; onPanelChange: (value: boolean) => void;
}) {
  const {chat, room, state: roomState} = useWorkspaceRoom(memory, fallback);
  const MessageList = Platform.OS === 'ios' && room ? BoundedMessageList : Animated.FlatList<ChatMessage>;
  const colors = usePalette();
  const styles = useStyles();
  const insets = useSafeAreaInsets(), pane = useDesktopPane(), actions = navigationActionMetrics(scale), window = useWindowDimensions();
  const safe = pane ? {top: 0, bottom: 0, left: 0, right: 0} : insets;
  const [attachments, setAttachments] = useState(false), [menu, setMenu] = useState(false);
  const geometry = inputMetrics(pane?.width ?? window.width, window.fontScale, !!pane);
  const [composerHeight, setComposerHeight] = useState(inputLayout(geometry, geometry.line, !!chat.draftImage).height + safe.bottom + geometry.gap + 10);
  useEffect(() => onPanelChange(attachments || menu), [attachments, menu, onPanelChange]);
  const {list, scroll} = useListScroll<ChatMessage>();
  const scrolling = usePlainScrollMemory(memory, `chat:${chat.id}`, scroll);
  const savedScroll = memory.getScroll(`chat:${chat.id}`);
  // An explicitly remembered top position is different from an unopened room.
  const initialScroll = useRef(room ? !savedScroll.anchor : savedScroll.offset === 0 && savedScroll.maxOffset === 0);
  const followEnd = useRef(initialScroll.current);
  const compactComposer = inputLayout(geometry, geometry.line, false).height + safe.bottom + geometry.gap + 10;
  const sending = useMessageSendMotion(scroll, compactComposer, geometry.textTop);
  const chrome = useChatChrome(() => {sending.finish(); dismissChatKeyboard(); setAttachments(false); setMenu(false);}, composerHeight, navigation.headerHeight * scale, savedScroll.offset, roomState ?? {});
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
  const flyingIndex = chat.messages.findIndex(message => message.id === sending.flight?.id);
  const flyingMessage = chat.messages[flyingIndex];
  const canSend = !!chat.draft.trim() || !!chat.draftImage;
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (menu) setMenu(false); else if (attachments) setAttachments(false); else onClose();
      return true;
    });
    return () => listener.remove();
  }, [attachments, menu, onClose]);
  function send() {
    if (!canSend) return;
    followEnd.current = true; initialScroll.current = true;
    const message = memory.sendChat(chat.id);
    if (message) sending.prepare(message.id, composerHeight);
    setAttachments(false);
  }
  return <View testID="ui-chat-room" style={styles.screen}>
    <View style={{flex: 1, paddingTop: safe.top}}>
      <Animated.View testID="ui-chat-header-visibility" pointerEvents={!pane && chrome.headerHidden ? 'none' : 'auto'} accessibilityElementsHidden={!pane && chrome.headerHidden}
        importantForAccessibility={!pane && chrome.headerHidden ? 'no-hide-descendants' : 'auto'}
        style={{position: 'absolute', top: safe.top, left: 0, right: 0, zIndex: 2, height: navigation.headerHeight * scale,
          opacity: pane ? 1 : chrome.header, transform: [{translateY: pane ? 0 : chrome.header.interpolate({inputRange: [0, 1], outputRange: [-10, 0]})}], overflow: 'hidden'}}>
      <View testID="ui-chat-room-header" style={[styles.header, {height: navigation.headerHeight * scale, paddingLeft: actions.backInset, paddingRight: actions.endInset}]}>
        <NavigationButton testID="ui-chat-room-back" icon="back" label="이전 화면으로 돌아가기" scale={scale} onPress={onClose}/>
        <View style={styles.headerAvatar}><PreviewArtwork tile={chat.tile} width={36} height={36}/></View>
        <Text accessibilityRole="header" numberOfLines={1} style={[styles.headerName, pane && {fontSize: 16}]}>{chat.character || chat.title}</Text>
        <NavigationButton testID="ui-chat-room-more" icon="more" label="채팅 메뉴" scale={scale} onPress={() => setMenu(value => !value)} expanded={menu}/>
      </View>
      </Animated.View>
      <ChatKeyboardBody onViewport={updateViewport}><CellLayout.Provider value={cellLayout}><MessageList ref={list}
        {...(room ? {} : scrolling)} data={chat.messages} keyExtractor={message => message.id} CellRendererComponent={MessageCell}
        initialNumToRender={Math.min(tuning.messagePage, chat.messages.length)} maxToRenderPerBatch={tuning.renderBatch} windowSize={pane ? tuning.desktopRenderWindow : tuning.renderWindow}
        maintainVisibleContentPosition={{minIndexForVisible: 0}} {...(nativeMessageAnchoring ? {} : {renderScrollComponent: ManualAnchorScroll})}
        scrollEventThrottle={16} testID="ui-chat-messages" style={styles.messages}
        contentContainerStyle={[styles.messageBody, {paddingTop: navigation.headerHeight * scale + 6, paddingBottom: (sending.flight ? compactComposer : composerHeight) + 12}]}
        contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} automaticallyAdjustKeyboardInsets={false} showsVerticalScrollIndicator={false}
        {...(pane ? {} : chrome.touchHandlers)} removeClippedSubviews={false} onScrollBeginDrag={() => {chrome.cancel(); sending.finish();}}
        keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onScroll={Animated.event([{nativeEvent: {contentOffset: {y: chrome.scrollY}}}], {useNativeDriver: Platform.OS === 'ios' || Platform.OS === 'android', listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
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
        }})} onContentSizeChange={(width, height) => {
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
        }} onLayout={event => {if (!room) scrolling.onLayout(event);
          // Mobile viewport changes are already anchored by the native keyboard
          // surface. A second JS scroll can use an intermediate IME frame.
          if (Platform.OS === 'web' && !sending.isActive() && followEnd.current) scroll.current?.scrollToEnd({animated: false});}}
        renderItem={({item: message, index}) => {
          const outgoing = message.role === 'user', group = groupedMessage(chat.messages, index);
          const flying = message.id === sending.flight?.id;
          return <Animated.View testID={`ui-chat-message-${message.id}`}
            style={[styles.messageRow, {justifyContent: outgoing ? 'flex-end' : 'flex-start', marginTop: group.before ? 3 : 16,
              opacity: flying || sending.flight?.phase === 'measuring' ? 0 : 1, transform: [{translateY: flying ? 0 : sending.historyY}]}]}>
            {!outgoing && <View style={styles.avatarSpace}>{!group.after && <View testID={`ui-message-avatar-${message.id}`} style={styles.avatar}>
              <PreviewArtwork tile={chat.tile} width={32} height={32}/>
            </View>}</View>}
            <MessageBubble message={message} group={group} onLayout={event => sending.onBubble(message.id, event.nativeEvent.layout)}/>
          </Animated.View>;
        }}/></CellLayout.Provider>
      {sending.flight?.phase === 'measuring' && <View testID="ui-chat-send-history" pointerEvents="none" accessible={false}
        accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
        {sending.flight.frozenRows.map(({id, layout}) => {
          const index = chat.messages.findIndex(message => message.id === id), message = chat.messages[index];
          if (!message) return null;
          const group = groupedMessage(chat.messages, index), outgoing = message.role === 'user';
          return <View key={id} style={[styles.messageRow, {position: 'absolute', left: layout.x, top: layout.y,
            width: layout.width, height: layout.height, justifyContent: outgoing ? 'flex-end' : 'flex-start'}]}>
            {!outgoing && <View style={styles.avatarSpace}>{!group.after && <View style={styles.avatar}>
              <PreviewArtwork tile={chat.tile} width={32} height={32}/>
            </View>}</View>}
            <MessageBubble message={message} group={group} ghost/>
          </View>;
        })}
      </View>}
      </ChatKeyboardBody>
      {attachments && <ChatKeyboardDock safeBottom={safe.bottom}><View testID="ui-chat-attachments" style={[styles.attachmentPanel, {position: 'absolute', bottom: composerHeight, left: 0, right: 0, backgroundColor: colors.background}]}>
        <View style={styles.attachmentHeading}><Text style={styles.panelTitle}>갤러리</Text>
          <NavigationButton icon="close" label="갤러리 닫기" scale={scale} onPress={() => setAttachments(false)}/></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentPictures}>
          {gallery.map(picture => <Pressable key={picture.id} testID={`ui-chat-attach-${picture.id}`} accessibilityRole="button" accessibilityLabel={`${picture.title} 첨부`}
            onPress={() => {memory.updateChatImage(chat.id, picture); setAttachments(false);}} style={styles.attachmentPicture}>
            <PreviewArtwork tile={picture.tile} width={88} height={88}/>
          </Pressable>)}
        </ScrollView>
      </View></ChatKeyboardDock>}
      {menu && <View style={[styles.menu, {top: safe.top + navigation.headerHeight * scale, right: actions.endInset}]}>
        <Pressable accessibilityRole="button" accessibilityLabel="최근 메시지로 이동" onPress={() => {followEnd.current = true; initialScroll.current = true;
          void room?.latest(); scroll.current?.scrollToEnd({animated: true}); setMenu(false);}} style={styles.menuItem}>
          <Text style={styles.panelTitle}>최근 메시지로 이동</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="메뉴 닫기" onPress={() => setMenu(false)} style={styles.menuItem}><Text style={styles.panelTitle}>닫기</Text></Pressable>
      </View>}
    </View>
    <ChatInput value={chat.draft} image={chat.draftImage} blocker={blocker} sendPhase={sending.flight?.phase} hidden={!pane && chrome.composerHidden} {...(!pane ? {translateY: chrome.composerTranslateY} : {})}
      onChange={text => {sending.finish(); memory.updateChatDraft(chat.id, text);}}
      onSend={send} onAttach={() => {dismissChatKeyboard(); setAttachments(value => !value);}}
      onRemoveImage={() => memory.updateChatImage(chat.id, null)} onHeight={setComposerHeight}
      onFocus={() => {setAttachments(false); setMenu(false); if (chrome.hidden) {followEnd.current = true; scroll.current?.scrollToEnd({animated: false});}}}/>
    <ChatKeyboardDock safeBottom={safe.bottom}>
      {sending.flight?.phase === 'flying' && flyingMessage && <Animated.View testID="ui-chat-send-flight" pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={[{position: 'absolute', right: 14, bottom: sending.flight.bottom, width: sending.flight.width, height: sending.flight.height}, sending.ghostStyle]}>
        <MessageBubble message={flyingMessage} group={groupedMessage(chat.messages, flyingIndex)} width={sending.flight.width} height={sending.flight.height} ghost/>
      </Animated.View>}
    </ChatKeyboardDock>
  </View>;
}

const MessageBubble = memo(function MessageBubble({message, group, width, height, ghost = false, onLayout}: {message: ChatMessage; group: {before: boolean; after: boolean};
  width?: number; height?: number; ghost?: boolean; onLayout?: (event: LayoutChangeEvent) => void}) {
  const styles = useStyles(), colors = usePalette(), outgoing = message.role === 'user', desktop = useDesktopPane();
  return <View onLayout={onLayout} style={[styles.bubble, desktop && {paddingHorizontal: 13, paddingVertical: 9}, {backgroundColor: outgoing ? colors.selectedBackground : colors.surface},
    width === undefined ? {} : {width, maxWidth: '100%'},
    height === undefined ? {} : {height},
    outgoing ? {borderTopRightRadius: group.before ? 6 : 24, borderBottomRightRadius: group.after ? 6 : 24}
      : {borderTopLeftRadius: group.before ? 6 : 24, borderBottomLeftRadius: group.after ? 6 : 24}]}>
    {message.image && <View style={styles.messageImage}><PreviewArtwork tile={message.image.tile} width={200} height={160}/></View>}
    {!!message.text && <Text selectable={!ghost} textBreakStrategy="simple" android_hyphenationFrequency="none"
      style={[styles.messageText, desktop && desktopMetrics.conversation, {color: outgoing ? colors.selectedForeground : colors.foreground}]}>{message.text}</Text>}
  </View>;
}, (a, b) => a.message === b.message && a.group.before === b.group.before && a.group.after === b.group.after &&
  a.width === b.width && a.height === b.height && a.ghost === b.ghost);

const useStyles = themedStyles(colors => ({
  screen: {flex: 1, minHeight: 0, backgroundColor: colors.background},
  header: {flexDirection: 'row', alignItems: 'center', flexShrink: 0, backgroundColor: colors.background},
  headerAvatar: {width: 36, height: 36, borderRadius: 18, overflow: 'hidden', marginLeft: 8, backgroundColor: colors.surface},
  headerName: {fontSize: 18, fontWeight: '600', color: colors.foreground, marginLeft: 12, flex: 1},
  messages: {flex: 1, minHeight: 0}, messageBody: {paddingHorizontal: 14, paddingTop: 6, paddingBottom: 12},
  messageRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 10},
  avatarSpace: {width: 32, flexShrink: 0}, avatar: {width: 32, height: 32, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface},
  bubble: {maxWidth: '78%', flexShrink: 1, borderRadius: 24, paddingHorizontal: 15, paddingVertical: 11, overflow: 'hidden'},
  messageText: {fontSize: 17, lineHeight: 25, includeFontPadding: false}, messageImage: {width: 200, maxWidth: '100%', height: 160, borderRadius: 12, overflow: 'hidden', marginVertical: 3},
  attachmentPanel: {paddingHorizontal: 20, paddingBottom: 10}, attachmentHeading: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  panelTitle: {fontSize: 16, fontWeight: '600', color: colors.foreground}, attachmentPictures: {gap: 8},
  attachmentPicture: {width: 88, height: 88, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface},
  menu: {position: 'absolute', zIndex: 3, padding: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background},
  menuItem: {padding: 14, minHeight: 48},
}));
