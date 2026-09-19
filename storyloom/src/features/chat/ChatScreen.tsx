import {memo, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Workspace} from '../../app/workspace';
import type {Message} from './model';
import {ChatComposer} from './ChatComposer';
import {useAppearance} from '../appearance/AppAppearance';

export function ChatScreen({workspace: w, width}: {workspace: Workspace; width: number}) {
  const {colors: c} = useAppearance();
  const {repo, creation, provider} = w.runtime;
  useSyncExternalStore(creation.subscribe, creation.snapshot);
  const conversation = w.conversation;
  const card = w.cards.find(item => item.id === conversation?.cardId);
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [composerReady, setComposerReady] = useState(false);
  const list = useRef<FlatList<Message>>(null);
  const loadedId = useRef('');
  const latestInput = useRef('');
  const scrollNearBottom = useRef(true);
  const live = conversation ? creation.live(conversation.id) : undefined;
  const activeId = live?.requestId;
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false));
    return () => {show.remove(); hide.remove();};
  }, []);
  useEffect(() => {
    if (!conversation) return;
    let active = true;
    void repo.messages(conversation.id).then(items => {if (active) {setMessages(items); setHasMore(items.length === 40);}}).catch(e => w.report(e));
    return () => {active = false;};
  }, [repo, conversation, activeId, w]);
  useEffect(() => {
    if (!conversation) return;
    let active = true;
    loadedId.current = ''; setInput(''); setComposerReady(false);
    void repo.getSetting(`composer:${conversation.id}`).then(value => {
      if (active) {setInput(value ?? ''); latestInput.current = value ?? ''; loadedId.current = conversation.id; setComposerReady(true);}
    }).catch(e => w.report(e));
    return () => {
      active = false;
      if (loadedId.current === conversation.id) {
        void repo.setSetting(`composer:${conversation.id}`, latestInput.current).catch(e => w.report(e));
        loadedId.current = '';
      }
    };
  }, [repo, conversation, w]);
  useEffect(() => {
    if (!conversation || loadedId.current !== conversation.id) return;
    const timer = setTimeout(() => {void repo.setSetting(`composer:${conversation.id}`, input).catch(e => w.report(e));}, 300);
    return () => clearTimeout(timer);
  }, [repo, conversation, input, w]);
  const visible = live ? messages.some(m => m.id === live.message.id) ? messages.map(m => m.id === live.message.id ? live.message : m) : [...messages, live.message] : messages;
  const send = async () => {
    if (!conversation || !card || !input.trim() || sending || live) return;
    const sentInput = input;
    setSending(true);
    const accepted = () => {
      if (loadedId.current === conversation.id && latestInput.current === sentInput) {
        setInput(''); latestInput.current = '';
        void repo.setSetting(`composer:${conversation.id}`, '').catch(e => w.report(e));
      }
    };
    try {
      if (provider.connected) await creation.send(card, conversation.id, sentInput, undefined, accepted);
      else {
        await repo.appendLocalUserMessage(conversation.id, sentInput);
        accepted();
        w.inform('AI 연결 전이에요. 메시지는 이 기기에만 저장했어요.');
      }
      const saved = await repo.messages(conversation.id);
      if (loadedId.current === conversation.id) setMessages(saved);
      await w.refresh();
    } catch (error) {w.report(error);} finally {setSending(false);}
  };
  return <KeyboardAvoidingView style={{flex: 1}} behavior="padding" enabled={Platform.OS !== 'android' || keyboard} keyboardVerticalOffset={insets.top}>
    <FlatList ref={list} testID="chat-messages" data={visible} keyExtractor={item => item.id} initialNumToRender={20} maxToRenderPerBatch={12} windowSize={7} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={{flex: 1}} contentContainerStyle={{paddingHorizontal: 22, paddingTop: 24, paddingBottom: 22, width: '100%', maxWidth: 800, alignSelf: 'center'}} onScroll={e => {const v = e.nativeEvent; scrollNearBottom.current = v.contentSize.height - v.layoutMeasurement.height - v.contentOffset.y < 130;}} scrollEventThrottle={100} onContentSizeChange={() => {if (scrollNearBottom.current) list.current?.scrollToEnd({animated: false});}} ListHeaderComponent={hasMore && conversation ? <Pressable accessibilityRole="button" onPress={() => {void repo.messages(conversation.id, messages[0]?.sequence).then(older => {setMessages([...older, ...messages]); setHasMore(older.length === 40);}).catch(e => w.report(e));}} style={{alignSelf: 'center', padding: 14, marginBottom: 14}}><Text style={{color: c.muted, fontSize: 13}}>이전 대화 보기</Text></Pressable> : null} renderItem={({item}) => <MessageBubble message={item}/>}/>
    {live && live.omitted > 0 && <Text style={{color: c.muted, fontSize: 11, paddingHorizontal: 22, paddingBottom: 10}}>입력 한도에 맞춰 이전 메시지 {live.omitted}개를 제외했어요. 기록은 유지됩니다.</Text>}
    <ChatComposer value={input} onChange={value => {setInput(value); latestInput.current = value;}} onSend={() => void send()} onCancel={() => {if (live) creation.cancel(live.requestId);}} onHint={message => w.inform(message)} width={width} bottom={keyboard ? 0 : insets.bottom} ready={composerReady} sending={sending} generating={!!live}/>
  </KeyboardAvoidingView>;
}

const MessageBubble = memo(function MessageBubble({message}: {message: Message}) {
  const {colors: c} = useAppearance();
  const mine = message.role === 'user';
  const state = {pending: '응답 준비 중', generating: '작성 중…', completed: '', cancelled: '생성 중단됨', failed: '생성 실패', interrupted: '이전 실행에서 중단됨'}[message.status];
  return <View style={{alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 24, gap: 7}}>
    <View style={{maxWidth: '88%', paddingHorizontal: 18, paddingVertical: 13, borderRadius: 22, backgroundColor: mine ? c.bubble : 'transparent'}}><Text selectable style={{color: c.text, fontSize: 17, lineHeight: 26}}>{message.content || '···'}</Text></View>
    {mine && message.requestId === null && <Text style={{fontSize: 11, color: c.placeholder, paddingHorizontal: 5}}>기기에만 저장됨</Text>}
    {state ? <Text style={{fontSize: 11, color: c.muted}}>{state}</Text> : null}
    {message.error && <Text style={{fontSize: 12, lineHeight: 19, color: c.error}}>{message.error}</Text>}
  </View>;
});
