import {createRef, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {BackHandler, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {ChatRow} from './screenState';
import type {ScreenMemory} from './ScreenMemory';
import type {GalleryImage} from './cardDetails';
import type {BackTransition} from './backTransition';
import type {GestureBlockRef} from './HorizontalGesture.types';
import {SwipeBack} from './SwipeBack';
import {NavigationButton} from './Navigation';
import {ChatInput} from './chat-input/ChatInput';
import {ChatKeyboardProvider, dismissChatKeyboard, useChatKeyboard} from './chat-input/KeyboardDock';
import {PreviewArtwork} from './PreviewArtwork';
import {colors, navigation, navigationActionMetrics} from './tokens';
import {inputLayout, inputMetrics} from './chat-input/geometry';
import {groupedMessage} from './chatConversation';
import {usePlainScrollMemory} from './usePlainScrollMemory';

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
  const safe = useSafeAreaInsets(), actions = navigationActionMetrics(scale), window = useWindowDimensions(), keyboard = useChatKeyboard();
  const [attachments, setAttachments] = useState(false), [menu, setMenu] = useState(false);
  const geometry = inputMetrics(window.width, window.fontScale);
  const [composerHeight, setComposerHeight] = useState(inputLayout(geometry, geometry.line, !!chat.draftImage).height + safe.bottom + geometry.gap + 10);
  const keyboardOffset = Math.max(0, keyboard.height - safe.bottom);
  useEffect(() => onPanelChange(attachments || menu), [attachments, menu, onPanelChange]);
  const scroll = useRef<ScrollView>(null);
  const scrolling = usePlainScrollMemory(memory, `chat:${chat.id}`, scroll);
  const savedScroll = memory.getScroll(`chat:${chat.id}`);
  // An explicitly remembered top position is different from an unopened room.
  const initialScroll = useRef(savedScroll.offset === 0 && savedScroll.maxOffset === 0);
  const followEnd = useRef(initialScroll.current);
  const keyboardReflow = useRef(false);
  const canSend = !!chat.draft.trim() || !!chat.draftImage;
  useEffect(() => {
    const shown = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      keyboardReflow.current = true; setAttachments(false);
    });
    const settled = Keyboard.addListener('keyboardDidShow', () => {
      requestAnimationFrame(() => {scroll.current?.scrollToEnd({animated: false}); followEnd.current = true; keyboardReflow.current = false;});
    });
    return () => {shown.remove(); settled.remove();};
  }, []);
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
    memory.sendChat(chat.id); setAttachments(false);
  }
  return <View testID="ui-chat-room" style={styles.screen}>
    <View style={{flex: 1, paddingTop: safe.top}}>
      <View testID="ui-chat-room-header" style={[styles.header, {height: navigation.headerHeight * scale, paddingLeft: actions.backInset, paddingRight: actions.endInset}]}>
        <NavigationButton testID="ui-chat-room-back" icon="back" label="이전 화면으로 돌아가기" scale={scale} onPress={onClose}/>
        <View style={styles.headerAvatar}><PreviewArtwork tile={chat.tile} width={36} height={36}/></View>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.headerName}>{chat.character || chat.title}</Text>
        <NavigationButton testID="ui-chat-room-more" icon="more" label="채팅 메뉴" scale={scale} onPress={() => setMenu(value => !value)} expanded={menu}/>
      </View>
      <ScrollView ref={scroll} {...scrolling} testID="ui-chat-messages" style={styles.messages} contentContainerStyle={[styles.messageBody, {paddingBottom: composerHeight + keyboardOffset + 12}]}
        contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onScroll={event => {
          scrolling.onScroll(event);
          const {contentOffset, contentSize, layoutMeasurement} = event.nativeEvent;
          if (!keyboardReflow.current) followEnd.current = contentSize.height - layoutMeasurement.height - contentOffset.y < 80;
        }} onContentSizeChange={(width, height) => {
          scrolling.onContentSizeChange(width, height);
          if (initialScroll.current || followEnd.current) {
            scroll.current?.scrollToEnd({animated: !initialScroll.current}); initialScroll.current = false;
          }
        }} onLayout={event => {scrolling.onLayout(event); if (followEnd.current) scroll.current?.scrollToEnd({animated: false});}}>
        {chat.messages.map((message, index) => {
          const outgoing = message.role === 'user', group = groupedMessage(chat.messages, index);
          return <View key={message.id} testID={`ui-chat-message-${message.id}`} style={[styles.messageRow,
            {justifyContent: outgoing ? 'flex-end' : 'flex-start', marginTop: group.before ? 3 : 16}]}>
            {!outgoing && <View style={styles.avatarSpace}>{!group.after && <View testID={`ui-message-avatar-${message.id}`} style={styles.avatar}>
              <PreviewArtwork tile={chat.tile} width={32} height={32}/>
            </View>}</View>}
            <View style={[styles.bubble, {backgroundColor: outgoing ? colors.selectedBackground : colors.surface},
              outgoing ? {borderTopRightRadius: group.before ? 6 : 24, borderBottomRightRadius: group.after ? 6 : 24}
                : {borderTopLeftRadius: group.before ? 6 : 24, borderBottomLeftRadius: group.after ? 6 : 24}]}>
              {message.image && <View style={styles.messageImage}><PreviewArtwork tile={message.image.tile} width={200} height={160}/></View>}
              {!!message.text && <Text selectable style={[styles.messageText, {color: outgoing ? colors.selectedForeground : colors.foreground}]}>{message.text}</Text>}
            </View>
          </View>;
        })}
      </ScrollView>
      {attachments && <View testID="ui-chat-attachments" style={[styles.attachmentPanel, {position: 'absolute', bottom: composerHeight + keyboardOffset, left: 0, right: 0, backgroundColor: colors.background}]}>
        <View style={styles.attachmentHeading}><Text style={styles.panelTitle}>갤러리</Text>
          <NavigationButton icon="close" label="갤러리 닫기" scale={scale} onPress={() => setAttachments(false)}/></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentPictures}>
          {gallery.map(picture => <Pressable key={picture.id} testID={`ui-chat-attach-${picture.id}`} accessibilityRole="button" accessibilityLabel={`${picture.title} 첨부`}
            onPress={() => {memory.updateChatImage(chat.id, picture); setAttachments(false);}} style={styles.attachmentPicture}>
            <PreviewArtwork tile={picture.tile} width={88} height={88}/>
          </Pressable>)}
        </ScrollView>
      </View>}
      {menu && <View style={[styles.menu, {top: safe.top + navigation.headerHeight * scale, right: actions.endInset}]}>
        <Pressable accessibilityRole="button" accessibilityLabel="최근 메시지로 이동" onPress={() => {scroll.current?.scrollToEnd({animated: true}); setMenu(false);}} style={styles.menuItem}>
          <Text style={styles.panelTitle}>최근 메시지로 이동</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="메뉴 닫기" onPress={() => setMenu(false)} style={styles.menuItem}><Text style={styles.panelTitle}>닫기</Text></Pressable>
      </View>}
    </View>
    <ChatInput value={chat.draft} image={chat.draftImage} blocker={blocker} onChange={text => memory.updateChatDraft(chat.id, text)}
      onSend={send} onAttach={() => {dismissChatKeyboard(); setAttachments(value => !value);}}
      onRemoveImage={() => memory.updateChatImage(chat.id, null)} onHeight={setComposerHeight}
      onFocus={() => {setAttachments(false); setMenu(false); followEnd.current = true; keyboardReflow.current = true;}}/>
  </View>;
}

const styles = StyleSheet.create({
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
  menu: {position: 'absolute', padding: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background},
  menuItem: {padding: 14, minHeight: 48},
});
