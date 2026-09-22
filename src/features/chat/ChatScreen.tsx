import {useRef, useState, useSyncExternalStore, type ReactNode} from 'react';
import {FlatList, Pressable, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Message} from './model';
import {ChatComposer} from './ChatComposer';
import {ChatMessage} from './ChatMessage';
import {composerScale, referenceComposer, referenceMessage as r} from './chatAppearance';
import {headerScale, referenceHeader} from '../../layout/metrics';
import {useKeyboardFrame} from '../../layout/KeyboardMotion';
import {useStartupScreen} from '../../layout/StartupScreen';
import {useAppearance} from '../appearance/AppAppearance';
import {useChatMessages} from './useChatMessages';
import {useChatSession} from './useChatSession';
import type {ChatSession} from './ChatSession';
import type {MessageReader} from './store';
import type {CreationService} from './service';
import type {SummaryExtensions} from '../../extensions/SummaryExtensions';
import {ChatSummaryAction} from '../../extensions/ChatSummaryAction';

export function ChatScreen({session, repo, creation, extensions, width, header, report, inform}: {
  session: ChatSession; repo: MessageReader; creation: CreationService; width: number; header?: ReactNode;
  extensions?: SummaryExtensions;
  report: (error: unknown) => void; inform: (message: string) => void;
}) {
  const {colors: c, mode} = useAppearance();
  const s = composerScale(width);
  useSyncExternalStore(creation.subscribe, creation.snapshot);
  const state = useChatSession(session);
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardFrame();
  const [composerHeight, setComposerHeight] = useState((referenceComposer.compactHeight + referenceComposer.bottom) * s + insets.bottom);
  const [expanded, setExpanded] = useState(false);
  const [extensionHeight, setExtensionHeight] = useState(0);
  const [laidOut, setLaidOut] = useState(false);
  const list = useRef<FlatList<Message>>(null);
  const scrollNearBottom = useRef(true);
  const live = creation.live(session.conversationId);
  const history = useChatMessages(repo, session.conversationId, `${state.messageRevision}:${live?.requestId ?? ''}`, report);
  // Dismiss the native launch screen only after the chat and its saved input
  // have committed, so the placeholder does not flash before the draft.
  useStartupScreen(laidOut && (state.ready || !!state.error), mode);
  const {messages, hasMore, loadingOlder, loadOlder} = history;
  const visible = live ? messages.some(m => m.id === live.message.id) ? messages.map(m => m.id === live.message.id ? live.message : m) : [...messages, live.message] : messages;
  const previousMessages = hasMore ? <Pressable accessibilityRole="button" disabled={loadingOlder} onPress={() => void loadOlder().catch(report)} style={{alignSelf: 'center', padding: 14, marginBottom: 14}}>
    <Text style={{color: c.muted, fontSize: 13}}>{loadingOlder ? '불러오는 중…' : '이전 대화 보기'}</Text>
  </Pressable> : null;
  // Insets belong to the scroll content, so messages can pass behind each
  // floating control without a permanent top or bottom strip covering them.
  const keyboardOffset = Math.max(0, keyboard.height - insets.bottom);
  return <View style={{flex: 1}} onLayout={() => setLaidOut(true)}>
    <FlatList ref={list} testID="chat-messages" data={visible} keyExtractor={item => item.id} initialNumToRender={20} maxToRenderPerBatch={12} windowSize={7} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" pointerEvents={expanded ? 'none' : 'auto'} aria-hidden={expanded} accessibilityElementsHidden={expanded} importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'} contentInsetAdjustmentBehavior="never" style={{flex: 1}} contentContainerStyle={{paddingHorizontal: r.inset * s, paddingTop: insets.top + referenceHeader.barHeight * headerScale(width) + r.top * s + extensionHeight, paddingBottom: composerHeight + keyboardOffset + r.bottom * s, width: '100%', maxWidth: 800, alignSelf: 'center'}} onScroll={e => {const v = e.nativeEvent; scrollNearBottom.current = v.contentSize.height - v.layoutMeasurement.height - v.contentOffset.y < 130;}} scrollEventThrottle={16} onContentSizeChange={() => {if (scrollNearBottom.current) list.current?.scrollToEnd({animated: false});}} ListHeaderComponent={previousMessages} ListFooterComponent={live && live.omitted > 0 ? <Text style={{color: c.muted, fontSize: 11, paddingVertical: 10}}>입력 한도에 맞춰 이전 메시지 {live.omitted}개를 제외했어요. 기록은 유지됩니다.</Text> : null} renderItem={({item}) => <ChatMessage message={item} width={width}/>}/>
    <View pointerEvents={expanded ? 'none' : 'box-none'} aria-hidden={expanded} accessibilityElementsHidden={expanded} importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'} style={{position: 'absolute', top: insets.top, left: 0, right: 0}}>{header}</View>
    {extensions && <ChatSummaryAction extensions={extensions} conversationId={session.conversationId} width={width} top={insets.top + referenceHeader.barHeight * headerScale(width)} hidden={expanded} onHeight={setExtensionHeight}/>}
    <ChatComposer value={state.draft.text} onChange={state.change} onSend={() => void state.send()} onCancel={state.cancel} onHint={inform} onHeight={setComposerHeight} onExpandedChange={setExpanded} width={width} bottom={insets.bottom} ready={state.ready} action={state.action}/>
  </View>;
}
