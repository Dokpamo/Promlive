import {useCallback, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, Text} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Workspace} from '../../app/workspace';
import type {Message} from './model';
import {ChatComposer} from './ChatComposer';
import {ChatMessage} from './ChatMessage';
import {composerScale, referenceMessage as r} from './chatAppearance';
import {useAppearance} from '../appearance/AppAppearance';
import {useChatMessages} from './useChatMessages';
import {useComposerDraft} from './useComposerDraft';
import {useChatSend} from './useChatSend';

export function ChatScreen({workspace: w, width}: {workspace: Workspace; width: number}) {
  const {colors: c} = useAppearance();
  const s = composerScale(width);
  const {repo, creation} = w.runtime;
  useSyncExternalStore(creation.subscribe, creation.snapshot);
  const conversation = w.conversation;
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);
  const list = useRef<FlatList<Message>>(null);
  const scrollNearBottom = useRef(true);
  const live = conversation ? creation.live(conversation.id) : undefined;
  const activeId = live?.requestId;
  const report = useCallback((error: unknown) => w.report(error), [w]);
  const history = useChatMessages(repo, conversation?.id, activeId, report);
  const draft = useComposerDraft(repo, conversation?.id, report);
  const {send, sending} = useChatSend(w, draft, history.refresh);
  const {messages, hasMore, loadingOlder, loadOlder} = history;
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false));
    return () => {show.remove(); hide.remove();};
  }, []);
  const visible = live ? messages.some(m => m.id === live.message.id) ? messages.map(m => m.id === live.message.id ? live.message : m) : [...messages, live.message] : messages;
  const previousMessages = hasMore ? <Pressable accessibilityRole="button" disabled={loadingOlder} onPress={() => void loadOlder().catch(report)} style={{alignSelf: 'center', padding: 14, marginBottom: 14}}>
    <Text style={{color: c.muted, fontSize: 13}}>{loadingOlder ? '불러오는 중…' : '이전 대화 보기'}</Text>
  </Pressable> : null;
  return <KeyboardAvoidingView style={{flex: 1}} behavior="padding" enabled={Platform.OS !== 'android' || keyboard} keyboardVerticalOffset={insets.top}>
    <FlatList ref={list} testID="chat-messages" data={visible} keyExtractor={item => item.id} initialNumToRender={20} maxToRenderPerBatch={12} windowSize={7} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={{flex: 1}} contentContainerStyle={{paddingHorizontal: r.inset * s, paddingTop: r.top * s, paddingBottom: r.bottom * s, width: '100%', maxWidth: 800, alignSelf: 'center'}} onScroll={e => {const v = e.nativeEvent; scrollNearBottom.current = v.contentSize.height - v.layoutMeasurement.height - v.contentOffset.y < 130;}} scrollEventThrottle={100} onContentSizeChange={() => {if (scrollNearBottom.current) list.current?.scrollToEnd({animated: false});}} ListHeaderComponent={previousMessages} renderItem={({item}) => <ChatMessage message={item} width={width}/>}/>
    {live && live.omitted > 0 && <Text style={{color: c.muted, fontSize: 11, paddingHorizontal: 22, paddingBottom: 10}}>입력 한도에 맞춰 이전 메시지 {live.omitted}개를 제외했어요. 기록은 유지됩니다.</Text>}
    <ChatComposer value={draft.value} onChange={draft.change} onSend={() => void send()} onCancel={() => {if (live) creation.cancel(live.requestId);}} onHint={message => w.inform(message)} width={width} bottom={keyboard ? 0 : insets.bottom} ready={draft.ready} sending={sending} generating={!!live}/>
  </KeyboardAvoidingView>;
}
