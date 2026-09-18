import {memo, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {View, Text, FlatList, TextInput, KeyboardAvoidingView, Platform} from 'react-native';
import type {Workspace} from '../../app/workspace';
import type {Message} from './model';
import {Button, Empty, Icon} from '../../layout/components';
import {colors, styles} from '../../layout/theme';

export function ChatScreen({workspace: w, width}: {workspace: Workspace; width: number}) {
  const {repo, creation, provider} = w.runtime;
  useSyncExternalStore(creation.subscribe, creation.snapshot);
  const conversation = w.conversation;
  const card = w.cards.find(c => c.id === conversation?.cardId);
  const [messages, setMessages] = useState<Message[]>([]); const [hasMore, setHasMore] = useState(false);
  const [input, setInput] = useState(''); const [sending, setSending] = useState(false);
  const [composerReady, setComposerReady] = useState(false);
  const list = useRef<FlatList<Message>>(null);
  const loadedId = useRef(''); const latestInput = useRef(''); const scrollNearBottom = useRef(true);
  const live = conversation ? creation.live(conversation.id) : undefined;
  const activeId = live?.requestId;
  useEffect(() => {
    if (!conversation) return;
    let active = true;
    void repo.messages(conversation.id).then(items => { if(active) {setMessages(items); setHasMore(items.length === 40);} }).catch(e => w.report(e));
    return () => {active = false;};
  }, [repo, conversation, activeId, w]);
  useEffect(() => {
    if (!conversation) return;
    let active = true; loadedId.current = ''; setInput(''); setComposerReady(false);
    void repo.getSetting(`composer:${conversation.id}`).then(value => {if(active) {setInput(value ?? ''); latestInput.current = value ?? ''; loadedId.current = conversation.id; setComposerReady(true);}}).catch(e => w.report(e));
    return () => {active = false; if(loadedId.current === conversation.id) {void repo.setSetting(`composer:${conversation.id}`, latestInput.current).catch(e => w.report(e)); loadedId.current = '';}};
  }, [repo, conversation, w]);
  useEffect(() => {
    if (!conversation || loadedId.current !== conversation.id) return;
    const timer = setTimeout(() => {void repo.setSetting(`composer:${conversation.id}`, input).catch(e => w.report(e));}, 300);
    return () => clearTimeout(timer);
  }, [repo, conversation, input, w]);
  if (!conversation || !card) return <Empty icon="chat" title="이야기 속으로 들어가 볼까요?" action={<Button onPress={() => void w.go('library').catch(e => w.report(e))}>서재에서 이야기 고르기</Button>}>카드를 선택하면 그 세계와 인물로 대화를 시작할 수 있어요.</Empty>;
  const character = card.body.kind === 'template' ? card.body.data.characterName || '이야기 속 인물' : card.title;
  const greeting = card.body.kind === 'template' ? card.body.data.greeting : '';
  const visible = live ? messages.some(m => m.id === live.message.id) ? messages.map(m => m.id === live.message.id ? live.message : m) : [...messages, live.message] : messages;
  const send = async () => {
    if (!input.trim() || sending || live) return;
    const sentInput = input;
    setSending(true);
    try {
      await creation.send(card, conversation.id, sentInput, undefined, () => {
        // Clear only the accepted input. A new draft typed during generation is independent.
        if (loadedId.current === conversation.id && latestInput.current === sentInput) {
          setInput(''); latestInput.current = '';
          void repo.setSetting(`composer:${conversation.id}`, '').catch(e => w.report(e));
        }
      });
      const saved = await repo.messages(conversation.id);
      if (loadedId.current === conversation.id) setMessages(saved);
      await w.refresh();
    } catch (error) {w.report(error);} finally {setSending(false);}
  };
  return <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
    <View style={[styles.row, {paddingHorizontal: width < 660 ? 20 : 35, paddingVertical: 18, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: '#FFF', justifyContent: 'space-between', gap: 10}]}>
      <View style={[styles.row, {gap: 12}]}><View style={{width: 41, height: 41, borderRadius: 15, backgroundColor: colors.accentSoft, justifyContent: 'center', alignItems: 'center'}}><Text style={{fontSize: 16, color: colors.accent}}>{character.slice(0, 1)}</Text></View><View style={{gap: 5}}><Text style={{fontSize: 15, color: colors.ink, fontWeight: '600'}}>{character}</Text><Text style={styles.small}>{provider.connected ? provider.label : 'AI 연결 대기'} · {card.title}</Text></View></View>
      <Button variant="ghost" small icon="plus" onPress={() => void w.startChat(card, true).catch(e => w.report(e))}>새 대화</Button>
    </View>
    <FlatList ref={list} data={visible} keyExtractor={item => item.id} initialNumToRender={20} maxToRenderPerBatch={12} windowSize={7} keyboardShouldPersistTaps="handled" style={{flex: 1}} contentContainerStyle={{paddingHorizontal: width < 660 ? 20 : 46, paddingTop: 26, paddingBottom: 25, width: '100%', maxWidth: 930, alignSelf: 'center'}} onScroll={e => {const s = e.nativeEvent; scrollNearBottom.current = s.contentSize.height - s.layoutMeasurement.height - s.contentOffset.y < 130;}} scrollEventThrottle={100} onContentSizeChange={() => {if(scrollNearBottom.current) list.current?.scrollToEnd({animated: false});}} ListHeaderComponent={<View style={{gap: 20, marginBottom: 28}}>
      {hasMore && <Button variant="secondary" small onPress={() => {void repo.messages(conversation.id, messages[0]?.sequence).then(older => {setMessages([...older, ...messages]); setHasMore(older.length === 40);}).catch(e => w.report(e));}}>이전 대화 더 보기</Button>}
      <View style={{alignItems: 'center', paddingVertical: 15, gap: 10}}><Icon name="spark" size={22} color="#BAA9C3"/><Text style={{fontSize: 11, letterSpacing: 1, color: colors.faint}}>새로운 페이지가 열렸습니다</Text></View>
      {greeting ? <View style={{padding: 22, backgroundColor: '#F0EDE7', borderRadius: 12, gap: 10}}><Text style={[styles.eyebrow, {fontSize: 9, letterSpacing: 1.5}]}>시작 장면 · 카드에 작성된 내용</Text><Text selectable style={[styles.body, {lineHeight: 27}]}>{greeting}</Text></View> : <Text style={[styles.small, {textAlign: 'center'}]}>첫 문장을 건네 보세요.</Text>}
    </View>} renderItem={({item}) => <MessageBubble message={item} character={character}/>}/>
    <View style={{width: '100%', maxWidth: 930, alignSelf: 'center', paddingHorizontal: width < 660 ? 16 : 40, paddingBottom: 18, gap: 9}}>
      {!provider.connected && <View style={[styles.row, {gap: 10, backgroundColor: '#ECE7F1', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 9, justifyContent: 'space-between'}]}><Text style={{fontSize: 11, color: colors.accent, flex: 1}}>아직 AI가 연결되지 않았어요. 작성 중인 메시지는 기기에 보관해요.</Text><Button variant="ghost" small onPress={() => void w.go('settings').catch(e => w.report(e))}>설정 ↗</Button></View>}
      {live && live.omitted > 0 && <Text style={styles.small}>입력 한도에 맞춰 이전 메시지 {live.omitted}개를 전송에서 제외했어요. 기록은 유지됩니다.</Text>}
      {creation.lastError() && <Text style={{fontSize: 12, color: colors.danger}}>{creation.lastError()}</Text>}
      <View style={[styles.row, {alignItems: 'flex-end', borderWidth: 1, borderColor: '#DCD6E0', borderRadius: 12, padding: 10, paddingLeft: 15, backgroundColor: '#FFF', gap: 10}]}>
        <TextInput accessibilityLabel="대화 메시지" value={input} editable={composerReady} onChangeText={value => {setInput(value); latestInput.current = value;}} placeholder={`${character}에게 말을 건네 보세요…`} placeholderTextColor={colors.faint} multiline maxLength={8000} style={{flex: 1, fontSize: 14, minHeight: 50, maxHeight: 140, paddingVertical: 8, color: colors.ink, lineHeight: 23}}/>
        {live ? <Button icon="stop" small onPress={() => creation.cancel(live.requestId)}>중단</Button> : <Button icon="send" small disabled={!provider.connected || !input.trim() || sending} onPress={() => void send()}>보내기</Button>}
      </View>
      <Text style={{fontSize: 10, lineHeight: 16, textAlign: 'center', color: colors.faint}}>전송 범위: 저장된 카드 설정 · 최근 최대 200개 중 입력 한도 내 대화 · 작성한 메시지</Text>
    </View>
  </KeyboardAvoidingView>;
}
const MessageBubble = memo(function MessageBubble({message, character}: {message: Message; character: string}) {
  const mine = message.role === 'user';
  const status = {pending: '응답 준비 중', generating: '작성 중…', completed: '', cancelled: '생성 중단됨', failed: '생성 실패', interrupted: '이전 실행에서 중단됨'}[message.status];
  return <View style={{alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 24, gap: 7}}><Text style={{fontSize: 11, color: colors.muted}}>{mine ? '나' : character}</Text><View style={{maxWidth: '92%', paddingHorizontal: 19, paddingVertical: 14, borderRadius: 12, backgroundColor: mine ? '#EAE3EF' : '#FFF', borderWidth: mine ? 0 : 1, borderColor: colors.line}}><Text selectable style={[styles.body, {lineHeight: 26}]}>{message.content || '· · ·'}</Text></View>{status && <Text style={{fontSize: 11, color: message.status === 'failed' ? colors.danger : colors.muted}}>{status}</Text>}{message.error && <Text style={{fontSize: 11, lineHeight: 18, color: colors.danger}}>{message.error}</Text>}</View>;
});
