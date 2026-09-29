import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {BackHandler, Keyboard, Platform, ScrollView, Text, TextInput, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Workspace} from './workspace';
import {conversationCards, libraryCards} from './collections';
import {useCollectionChrome} from './NavigationChrome';
import type {Card} from '../features/cards/model';
import type {Conversation} from '../features/chat/model';
import {CardThumbnail} from '../features/cards/CardThumbnail';
import {SettingsChoice, SettingsSheet} from '../features/settings/SettingsLayout';
import {ManagedItemList} from '../layout/ManagedItemList';
import {PagingBoundary, usePagingLock} from '../layout/PagingBoundary';
import {RowPressable} from '../layout/RowPressable';
import type {ScrollChromeBinding} from '../layout/scrollChrome';
import {FilterPill, ui, useDesign} from '../design/foundation';
import {CollectionHeader, collectionHeaderGeometry} from './CollectionHeader';

const inboxRow = {rowHeight: 168, lineHeight: 36, fontSize: 26, padding: 28, inset: 0, radius: 0, highlightInset: 0};
const noop = () => {};

/** The activity-style inbox opens conversations directly and filters by owning card. */
export function ChatsCollection({workspace: w, active, startChat, openConversation}: {
  workspace: Workspace; active: boolean; startChat: (card?: Card) => Promise<void>; openConversation: (room: Conversation) => Promise<void>;
}) {
  const {s, color} = useDesign(), safe = useSafeAreaInsets();
  const chrome = useCollectionChrome();
  const [cardId, setCardId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [focused, setFocused] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const input = useRef<TextInput>(null);
  const shortcutOffset = useRef(0);
  const cards = useMemo(() => new Map(w.cards.map(card => [card.id, card])), [w.cards]);
  const card = cardId ? cards.get(cardId) : undefined;
  const groups = useMemo(() => conversationCards(w.cards, w.history.items), [w.cards, w.history.items]);
  const rooms = useMemo(() => w.history.items.filter(room => cards.has(room.cardId) && (!card || room.cardId === card.id)), [w.history.items, cards, card]);
  const query = search.trim().toLocaleLowerCase();
  const filtered = rooms.filter(room => `${cards.get(room.cardId)?.title} ${room.title} ${room.preview ?? ''}`.toLocaleLowerCase().includes(query));
  const clearCard = useCallback(() => setCardId(null), []);
  const reset = chrome?.reset;
  const resetChrome = useCallback(() => {if (active) reset?.();}, [active, reset]);
  const bottomInset = chrome?.bottomInset ?? ui.tabBar * s + safe.bottom;
  const scrollChrome = useMemo<ScrollChromeBinding>(() => ({topInset: 0, bottomInset, reset: resetChrome, registerScroller: () => noop,
    onScroll: noop, onScrollBeginDrag: noop, onScrollEndDrag: noop, onMomentumScrollBegin: noop, onMomentumScrollEnd: noop,
  }), [bottomInset, resetChrome]);
  usePagingLock(active && focused);
  useEffect(() => {if (cardId && !card) setCardId(null);}, [cardId, card]);
  useEffect(() => {if (!active) {setCreateOpen(false); input.current?.blur(); setFocused(false);}}, [active]);
  useEffect(() => {
    if (!active || !focused) return;
    const closeSearch = () => {input.current?.blur(); Keyboard.dismiss(); setFocused(false); return true;};
    if (Platform.OS === 'android') {
      const subscription = BackHandler.addEventListener('hardwareBackPress', closeSearch);
      return () => subscription.remove();
    }
    if (Platform.OS !== 'web') return;
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape' && !event.defaultPrevented) {event.preventDefault(); event.stopImmediatePropagation(); closeSearch();}};
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, [active, focused]);
  const chooseCard = (id: string | null) => {Keyboard.dismiss(); setFocused(false); setCardId(id);};

  return <View testID="chat-inbox" style={{flex: 1, paddingTop: safe.top, backgroundColor: color.background}}>
    <View testID="collection-header">
      <CollectionHeader title="채팅" search={search} onSearch={setSearch} actionLabel={card ? `${card.title} 새 채팅` : '새 채팅'} disabled={selecting}
        onAction={() => {Keyboard.dismiss(); if (card) void startChat(card).catch(w.notifications.report); else setCreateOpen(true);}}
        inputRef={input} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        categories={<PagingBoundary>{scroll => <ScrollView {...scroll} testID="chat-card-shortcuts" horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          contentOffset={{x: shortcutOffset.current, y: 0}} onScroll={event => {shortcutOffset.current = event.nativeEvent.contentOffset.x;}} scrollEventThrottle={16}
          contentContainerStyle={{paddingHorizontal: ui.inset * s, height: collectionHeaderGeometry.categories * s, alignItems: 'center', gap: 10 * s}}>
          <FilterPill label="전체" accessibilityLabel="전체 채팅 보기" selected={!card} onPress={() => chooseCard(null)}/>
          {groups.map(group => <FilterPill key={group.card.id} label={group.card.title} accessibilityLabel={`${group.card.title} 채팅 ${group.count}개 보기`} selected={group.card.id === card?.id} onPress={() => chooseCard(group.card.id)}/>)}
        </ScrollView>}</PagingBoundary>}/>
    </View>
    <ManagedItemList key={card?.id ?? 'all'} scope="history" scale={s} active={active} backgroundColor={color.background} geometry={inboxRow}
      items={filtered} allItems={rooms} actions={w.history} library={card ? w.history.folderLibrary(card.id) : undefined} hideRootBreadcrumb rootLabel={card?.title ?? '메시지'}
      search={search} resetKey={`inbox:${card?.id ?? 'all'}:${search}`} scrollChrome={scrollChrome} onSelectionChange={setSelecting}
      {...(card ? {onBack: clearCard} : {})} empty={query ? '검색 결과가 없어요.' : '아직 채팅이 없어요.'}
      onOpen={room => {void openConversation(room).catch(w.notifications.report);}} report={w.notifications.report}
      openLabel={room => `${cards.get(room.cardId)!.title}, ${room.title} 채팅 열기`}
      leading={room => <View style={{height: '100%', paddingTop: 20 * s, marginRight: 22 * s}}><CardThumbnail cover={cards.get(room.cardId)!.cover} assetId={cards.get(room.cardId)!.coverAssetId} size={ui.avatar * s}/></View>}
      rowContent={room => <ConversationSummary room={room} card={cards.get(room.cardId)!}/>}
      intro={<>
        <View style={{paddingHorizontal: ui.inset * s, minHeight: 66 * s, paddingBottom: 18 * s, flexDirection: 'row', alignItems: 'center'}}>
          <Text accessibilityRole="header" numberOfLines={1} style={{flex: 1, color: color.text, fontSize: 24 * s, lineHeight: 35 * s, fontWeight: '600'}}>{card?.title ?? '최근 대화'}</Text>
          {!!card && <RowPressable accessibilityRole="button" accessibilityLabel="모든 카드의 채팅 보기" onPress={() => chooseCard(null)} radius={8 * s}
            contentStyle={{paddingHorizontal: 8 * s, paddingVertical: 8 * s}}><Text style={{color: color.accent, fontSize: 23 * s, fontWeight: '600'}}>전체 보기</Text></RowPressable>}
        </View>
      </>}/>
    {active && createOpen && <NewChatChoice cards={libraryCards(w.cards)} onClose={() => setCreateOpen(false)} startChat={startChat} report={w.notifications.report}/>}
  </View>;
}

function ConversationSummary({room, card}: {room: Conversation; card: Card}) {
  const {s, color} = useDesign();
  const named = room.title !== '새로운 대화';
  const date = new Date(room.updatedAt);
  // Absolute dates stay accurate while a retained tab is idle, without a timer per row.
  const timestamp = `${date.getMonth() + 1}월 ${date.getDate()}일`;
  return <View style={{flex: 1, height: '100%', paddingTop: 18 * s, paddingBottom: 18 * s, minWidth: 0, gap: 5 * s, borderBottomWidth: room.pinnedAt != null ? 0 : .5, borderBottomColor: color.line}}>
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 14 * s}}>
      <Text numberOfLines={1} style={{flex: 1, color: color.text, fontSize: 26 * s, lineHeight: 36 * s, fontWeight: '600', includeFontPadding: false}}>{named ? room.title : card.title}</Text>
      <Text style={{color: color.muted, fontSize: 19 * s, lineHeight: 28 * s, includeFontPadding: false}}>{timestamp}</Text>
    </View>
    <Text numberOfLines={1} style={{color: color.muted, fontSize: 24 * s, lineHeight: 33 * s, includeFontPadding: false}}>{named ? card.title : '새로운 대화'}</Text>
    {!!room.preview && <Text numberOfLines={2} style={{color: color.text, fontSize: 24 * s, lineHeight: 33 * s, includeFontPadding: false}}>{room.preview}</Text>}
  </View>;
}

function NewChatChoice({cards, onClose, startChat, report}: {cards: readonly Card[]; onClose: () => void; startChat: (card?: Card) => Promise<void>; report: (error: unknown) => void}) {
  const next = useRef<(() => Promise<void>) | null>(null);
  return <SettingsSheet title="새 채팅" onClose={() => {onClose(); const action = next.current; next.current = null; if (action) void action().catch(report);}}>{close => <>
    <SettingsChoice label="일반 채팅" selected={false} onPress={() => {next.current = () => startChat(); close();}}/>
    {cards.map(card => <SettingsChoice key={card.id} label={card.title} selected={false} onPress={() => {next.current = () => startChat(card); close();}}/>)}
  </>}</SettingsSheet>;
}
