import {usePalette, themedStyles} from './Theme';
import {createRef, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Animated, BackHandler, Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {ChatRow} from './screenState';
import type {ScreenMemory} from './ScreenMemory';
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

type Props = {chat: ChatRow; gallery: GalleryImage[]; memory: ScreenMemory; scale: number; onClose: () => void; transition: BackTransition};
export function ChatRoom(p: Props) {
  const [panelOpen, setPanelOpen] = useState(false);
  const blockers = useMemo(() => [createRef() as GestureBlockRef], []);
  const close = useCallback(() => {dismissChatKeyboard(); p.onClose();}, [p.onClose]);
  return <SwipeBack identity={p.chat.id} onBack={close} enabled={!panelOpen} blockers={blockers} transition={p.transition} drawBehindStatusBar>
    <ChatKeyboardProvider><ChatRoomContent {...p} onClose={close} blocker={blockers[0]!} onPanelChange={setPanelOpen}/></ChatKeyboardProvider>
  </SwipeBack>;
}
function ChatRoomContent({chat, gallery, memory, scale, onClose, blocker, onPanelChange}: Props & {
  blocker: GestureBlockRef; onPanelChange: (value: boolean) => void;
}) {
  const colors = usePalette();
  const styles = useStyles();
  const safe = useSafeAreaInsets(), actions = navigationActionMetrics(scale), window = useWindowDimensions();
  const [attachments, setAttachments] = useState(false), [menu, setMenu] = useState(false);
  const geometry = inputMetrics(window.width, window.fontScale);
  const [composerHeight, setComposerHeight] = useState(inputLayout(geometry, geometry.line, !!chat.draftImage).height + safe.bottom + geometry.gap + 10);
  useEffect(() => onPanelChange(attachments || menu), [attachments, menu, onPanelChange]);
  const scroll = useRef<ScrollView>(null);
  const scrolling = usePlainScrollMemory(memory, `chat:${chat.id}`, scroll);
  const savedScroll = memory.getScroll(`chat:${chat.id}`);
  // An explicitly remembered top position is different from an unopened room.
  const initialScroll = useRef(savedScroll.offset === 0 && savedScroll.maxOffset === 0);
  const followEnd = useRef(initialScroll.current);
  const compactComposer = inputLayout(geometry, geometry.line, false).height + safe.bottom + geometry.gap + 10;
  const sending = useMessageSendMotion(scroll, compactComposer, geometry.textTop);
  const chrome = useChatChrome(() => {sending.finish(); dismissChatKeyboard(); setAttachments(false); setMenu(false);}, composerHeight, navigation.headerHeight * scale, savedScroll.offset);
  const scrollFrame = useRef({height: 0, content: 0, offset: savedScroll.offset});
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
      <Animated.View testID="ui-chat-header-visibility" pointerEvents={chrome.headerHidden ? 'none' : 'auto'} accessibilityElementsHidden={chrome.headerHidden}
        importantForAccessibility={chrome.headerHidden ? 'no-hide-descendants' : 'auto'}
        style={{position: 'absolute', top: safe.top, left: 0, right: 0, zIndex: 2, height: navigation.headerHeight * scale,
          opacity: chrome.header, transform: [{translateY: chrome.header.interpolate({inputRange: [0, 1], outputRange: [-10, 0]})}], overflow: 'hidden'}}>
      <View testID="ui-chat-room-header" style={[styles.header, {height: navigation.headerHeight * scale, paddingLeft: actions.backInset, paddingRight: actions.endInset}]}>
        <NavigationButton testID="ui-chat-room-back" icon="back" label="이전 화면으로 돌아가기" scale={scale} onPress={onClose}/>
        <View style={styles.headerAvatar}><PreviewArtwork tile={chat.tile} width={36} height={36}/></View>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.headerName}>{chat.character || chat.title}</Text>
        <NavigationButton testID="ui-chat-room-more" icon="more" label="채팅 메뉴" scale={scale} onPress={() => setMenu(value => !value)} expanded={menu}/>
      </View>
      </Animated.View>
      <ChatKeyboardBody onViewport={updateViewport}><Animated.ScrollView ref={scroll} {...scrolling} scrollEventThrottle={16} testID="ui-chat-messages" style={styles.messages}
        contentContainerStyle={[styles.messageBody, {paddingTop: navigation.headerHeight * scale + 6, paddingBottom: (sending.flight ? compactComposer : composerHeight) + 12}]}
        contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} automaticallyAdjustKeyboardInsets={false} showsVerticalScrollIndicator={false}
        {...chrome.touchHandlers} removeClippedSubviews={false} onScrollBeginDrag={() => {chrome.cancel(); sending.finish();}}
        keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onScroll={Animated.event([{nativeEvent: {contentOffset: {y: chrome.scrollY}}}], {useNativeDriver: Platform.OS !== 'web', listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
          const {contentOffset, contentSize, layoutMeasurement} = event.nativeEvent;
          const height = scrollFrame.current.height || layoutMeasurement.height;
          scrolling.onScroll({...event, nativeEvent: {...event.nativeEvent, layoutMeasurement: {...layoutMeasurement, height}}});
          scrollFrame.current = {height, content: contentSize.height, offset: contentOffset.y};
          updateChrome(contentOffset.y, contentSize.height, height);
          sending.onScroll(contentOffset.y, height);
          followEnd.current = contentSize.height - height - contentOffset.y < 80;
        }})} onContentSizeChange={(width, height) => {
          scrolling.onContentSizeChange(width, height);
          scrollFrame.current.content = height;
          updateChrome(scrollFrame.current.offset, height, scrollFrame.current.height);
          sending.onContentSize(height);
          if (sending.isActive()) return;
          if (initialScroll.current || followEnd.current) {
            // Composer growth already supplies intermediate heights. Another
            // scroll animation here would make messages trail behind the input.
            scroll.current?.scrollToEnd({animated: false}); initialScroll.current = false;
          }
        }} onLayout={event => {scrolling.onLayout(event);
          // Mobile viewport changes are already anchored by the native keyboard
          // surface. A second JS scroll can use an intermediate IME frame.
          if (Platform.OS === 'web' && !sending.isActive() && followEnd.current) scroll.current?.scrollToEnd({animated: false});}}>
        {chat.messages.map((message, index) => {
          const outgoing = message.role === 'user', group = groupedMessage(chat.messages, index);
          const flying = message.id === sending.flight?.id;
          return <Animated.View key={message.id} testID={`ui-chat-message-${message.id}`} onLayout={event => sending.onRow(message.id, event.nativeEvent.layout)}
            style={[styles.messageRow, {justifyContent: outgoing ? 'flex-end' : 'flex-start', marginTop: group.before ? 3 : 16,
              opacity: flying || sending.flight?.phase === 'measuring' ? 0 : 1, transform: [{translateY: flying ? 0 : sending.historyY}]}]}>
            {!outgoing && <View style={styles.avatarSpace}>{!group.after && <View testID={`ui-message-avatar-${message.id}`} style={styles.avatar}>
              <PreviewArtwork tile={chat.tile} width={32} height={32}/>
            </View>}</View>}
            <MessageBubble message={message} group={group} onLayout={event => sending.onBubble(message.id, event.nativeEvent.layout)}/>
          </Animated.View>;
        })}
      </Animated.ScrollView>
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
        <Pressable accessibilityRole="button" accessibilityLabel="최근 메시지로 이동" onPress={() => {scroll.current?.scrollToEnd({animated: true}); setMenu(false);}} style={styles.menuItem}>
          <Text style={styles.panelTitle}>최근 메시지로 이동</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="메뉴 닫기" onPress={() => setMenu(false)} style={styles.menuItem}><Text style={styles.panelTitle}>닫기</Text></Pressable>
      </View>}
    </View>
    <ChatInput value={chat.draft} image={chat.draftImage} blocker={blocker} sendPhase={sending.flight?.phase} hidden={chrome.composerHidden} translateY={chrome.composerTranslateY}
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

function MessageBubble({message, group, width, height, ghost = false, onLayout}: {message: ChatMessage; group: {before: boolean; after: boolean};
  width?: number; height?: number; ghost?: boolean; onLayout?: (event: LayoutChangeEvent) => void}) {
  const styles = useStyles(), colors = usePalette(), outgoing = message.role === 'user';
  return <View onLayout={onLayout} style={[styles.bubble, {backgroundColor: outgoing ? colors.selectedBackground : colors.surface},
    width === undefined ? {} : {width, maxWidth: '100%'},
    height === undefined ? {} : {height},
    outgoing ? {borderTopRightRadius: group.before ? 6 : 24, borderBottomRightRadius: group.after ? 6 : 24}
      : {borderTopLeftRadius: group.before ? 6 : 24, borderBottomLeftRadius: group.after ? 6 : 24}]}>
    {message.image && <View style={styles.messageImage}><PreviewArtwork tile={message.image.tile} width={200} height={160}/></View>}
    {!!message.text && <Text selectable={!ghost} style={[styles.messageText, {color: outgoing ? colors.selectedForeground : colors.foreground}]}>{message.text}</Text>}
  </View>;
}

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
