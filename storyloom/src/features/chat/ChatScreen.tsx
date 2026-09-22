import {useCallback, useRef, useState, useSyncExternalStore, type ReactNode} from 'react';
import {FlatList, Pressable, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Workspace} from '../../app/workspace';
import type {Message} from './model';
import {ChatComposer} from './ChatComposer';
import {ChatMessage} from './ChatMessage';
import {composerScale, headerScale, referenceHeader, referenceComposer, referenceMessage as r} from './chatAppearance';
import {useKeyboardFrame} from '../../layout/KeyboardMotion';
import {useAppearance} from '../appearance/AppAppearance';
import {useChatMessages} from './useChatMessages';
import {useComposerDraft} from './useComposerDraft';
import {useChatSend} from './useChatSend';

export function ChatScreen({workspace: w, width, header}: {workspace: Workspace; width: number; header?: ReactNode}) {
  const {colors: c} = useAppearance();
  const s = composerScale(width);
  const {repo, creation} = w.runtime;
  useSyncExternalStore(creation.subscribe, creation.snapshot);
  const conversation = w.conversation;
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardFrame();
  const [composerHeight, setComposerHeight] = useState((referenceComposer.compactHeight + referenceComposer.bottom) * s + insets.bottom);
  const [expanded, setExpanded] = useState(false);
  const list = useRef<FlatList<Message>>(null);
  const scrollNearBottom = useRef(true);
  const live = conversation ? creation.live(conversation.id) : undefined;
  const activeId = live?.requestId;
  const report = useCallback((error: unknown) => w.report(error), [w]);
  const history = useChatMessages(repo, conversation?.id, activeId, report);
  const draft = useComposerDraft(repo, conversation?.id, report);
  const {send, sending} = useChatSend(w, draft, history.refresh);
  const {messages, hasMore, loadingOlder, loadOlder} = history;
  const visible = live ? messages.some(m => m.id === live.message.id) ? messages.map(m => m.id === live.message.id ? live.message : m) : [...messages, live.message] : messages;
  const previousMessages = hasMore ? <Pressable accessibilityRole="button" disabled={loadingOlder} onPress={() => void loadOlder().catch(report)} style={{alignSelf: 'center', padding: 14, marginBottom: 14}}>
    <Text style={{color: c.muted, fontSize: 13}}>{loadingOlder ? '불러오는 중…' : '이전 대화 보기'}</Text>
  </Pressable> : null;
  // Insets belong to the scroll content, so messages can pass behind each
  // floating control without a permanent top or bottom strip covering them.
  const keyboardOffset = Math.max(0, keyboard.height - insets.bottom);
  return <View style={{flex: 1}}>
    <FlatList ref={list} testID="chat-messages" data={visible} keyExtractor={item => item.id} initialNumToRender={20} maxToRenderPerBatch={12} windowSize={7} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" pointerEvents={expanded ? 'none' : 'auto'} aria-hidden={expanded} accessibilityElementsHidden={expanded} importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'} style={{flex: 1, marginTop: insets.top}} contentContainerStyle={{paddingHorizontal: r.inset * s, paddingTop: referenceHeader.barHeight * headerScale(width) + r.top * s, paddingBottom: composerHeight + keyboardOffset + r.bottom * s, width: '100%', maxWidth: 800, alignSelf: 'center'}} onScroll={e => {const v = e.nativeEvent; scrollNearBottom.current = v.contentSize.height - v.layoutMeasurement.height - v.contentOffset.y < 130;}} scrollEventThrottle={16} onContentSizeChange={() => {if (scrollNearBottom.current) list.current?.scrollToEnd({animated: false});}} ListHeaderComponent={previousMessages} ListFooterComponent={live && live.omitted > 0 ? <Text style={{color: c.muted, fontSize: 11, paddingVertical: 10}}>입력 한도에 맞춰 이전 메시지 {live.omitted}개를 제외했어요. 기록은 유지됩니다.</Text> : null} renderItem={({item}) => <ChatMessage message={item} width={width}/>}/>
    <View pointerEvents={expanded ? 'none' : 'box-none'} aria-hidden={expanded} accessibilityElementsHidden={expanded} importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'} style={{position: 'absolute', top: insets.top, left: 0, right: 0}}>{header}</View>
    <ChatComposer value={draft.value} onChange={draft.change} onSend={() => void send()} onCancel={() => {if (live) creation.cancel(live.requestId);}} onHint={message => w.inform(message)} onHeight={setComposerHeight} onExpandedChange={setExpanded} width={width} bottom={insets.bottom} ready={draft.ready} sending={sending} generating={!!live}/>
  </View>;
}
