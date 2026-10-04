import {CellLayout, MessageCell, MessageList, ManualAnchorScroll, nativeMessageAnchoring, type MessageListHandle} from './chat/MessageList';
import {useMessageViewport} from './chat/useMessageViewport';
import {MessageBubble} from './chat/MessageBubble';
import {useChatStyles} from './chat/styles';
import type {ChatRow, GalleryImage, ChatMessage} from '../features/workspace/model';
import {usePalette} from './Theme';
import {createRef, useCallback, useEffect, useMemo, useState} from 'react';
import {Animated, BackHandler, Platform, Pressable, ScrollView, Text, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {ScreenMemoryController as ScreenMemory} from './ScreenController';
import type {BackTransition} from './backTransition';
import type {GestureBlockRef} from './HorizontalGesture.types';
import {SwipeBack} from './SwipeBack';
import {NavigationButton} from './Navigation';
import {ChatInput} from './chat-input/ChatInput';
import {ChatKeyboardProvider, ChatKeyboardBody, ChatKeyboardDock, dismissChatKeyboard} from './chat-input/KeyboardDock';
import {PreviewArtwork} from './PreviewArtwork';
import {navigation, navigationActionMetrics} from './tokens';
import {inputLayout, inputMetrics} from './chat-input/geometry';
import {groupedMessage} from './chatConversation';
import {useMessageSendMotion} from './useMessageSendMotion';
import {useChatChrome} from './useChatChrome';
import {useDesktopPane} from './desktop/DesktopPane';
import {useWorkspaceRoom} from './workspace/hooks';
import {useListScroll} from './workspace/useListScroll';
import {workspaceTuning as tuning} from './workspace/tuning';

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
  const colors = usePalette();
  const styles = useChatStyles();
  const insets = useSafeAreaInsets(), pane = useDesktopPane(), actions = navigationActionMetrics(scale), window = useWindowDimensions();
  const safe = pane ? {top: 0, bottom: 0, left: 0, right: 0} : insets;
  const [attachments, setAttachments] = useState(false), [menu, setMenu] = useState(false);
  const geometry = inputMetrics(pane?.width ?? window.width, window.fontScale, !!pane);
  const [composerHeight, setComposerHeight] = useState(inputLayout(geometry, geometry.line, !!chat.draftImage).height + safe.bottom + geometry.gap + 10);
  useEffect(() => onPanelChange(attachments || menu), [attachments, menu, onPanelChange]);
  const {list, scroll} = useListScroll<ChatMessage, MessageListHandle>();
  const savedScroll = memory.getScroll(`chat:${chat.id}`);
  const compactComposer = inputLayout(geometry, geometry.line, false).height + safe.bottom + geometry.gap + 10;
  const sending = useMessageSendMotion(scroll, compactComposer, geometry.textTop);
  const chrome = useChatChrome(() => {sending.finish(); dismissChatKeyboard(); setAttachments(false); setMenu(false);}, composerHeight, navigation.headerHeight * scale, savedScroll.offset, roomState ?? {});
  const {scrolling, initialScroll, followEnd, cellLayout, updateViewport, onScroll, onContentSizeChange, onLayout} =
    useMessageViewport({memory, chat, room, roomState, scale, composerHeight, scroll, sending, chrome});
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
      <ChatKeyboardBody onViewport={updateViewport}><CellLayout.Provider value={cellLayout}><MessageList ref={list} bounded={Platform.OS === 'ios' && !!room}
        {...(room ? {} : scrolling)} data={chat.messages} keyExtractor={message => message.id} CellRendererComponent={MessageCell}
        initialNumToRender={Math.min(tuning.messagePage, chat.messages.length)} maxToRenderPerBatch={tuning.renderBatch} windowSize={pane ? tuning.desktopRenderWindow : tuning.renderWindow}
        maintainVisibleContentPosition={{minIndexForVisible: 0}} {...(nativeMessageAnchoring ? {} : {renderScrollComponent: ManualAnchorScroll})}
        scrollEventThrottle={16} testID="ui-chat-messages" style={styles.messages}
        contentContainerStyle={[styles.messageBody, {paddingTop: navigation.headerHeight * scale + 6, paddingBottom: (sending.flight ? compactComposer : composerHeight) + 12}]}
        contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} automaticallyAdjustKeyboardInsets={false} showsVerticalScrollIndicator={false}
        {...(pane ? {} : chrome.touchHandlers)} removeClippedSubviews={false} onScrollBeginDrag={() => {chrome.cancel(); sending.finish();}}
        keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onScroll={onScroll} onContentSizeChange={onContentSizeChange} onLayout={onLayout}
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
