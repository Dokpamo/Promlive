import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode} from 'react';
import {Animated, BackHandler, FlatList, Keyboard, Platform, Text, TextInput, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Workspace} from './workspace';
import {cardCreatorName, categoryCards, conversationCards, createdCards, libraryCards} from './collections';
import {useAppearance} from '../features/appearance/AppAppearance';
import type {Card} from '../features/cards/model';
import type {Conversation} from '../features/chat/model';
import {CardThumbnail} from '../features/cards/CardThumbnail';
import {CardCover} from '../features/cards/CardCover';
import {SettingsChoice, SettingsSheet} from '../features/settings/SettingsLayout';
import {SettingsIcon} from '../features/settings/SettingsIcon';
import {headerScale, referenceHeader, referencePageTitle} from '../layout/metrics';
import {panelReference} from '../layout/panelGeometry';
import {HeaderButton} from '../layout/ScreenHeader';
import {ManagedItemList} from '../layout/ManagedItemList';
import {RowPressable} from '../layout/RowPressable';
import {exportCardBundle} from '../features/authoring/cardBundle';
import {pickCardFile, saveCardFile} from '../adapters/files/cardFiles';
import {useCollectionChrome, useCollectionSelection} from './NavigationChrome';
import {useScrollChromeTarget, type ScrollChromeBinding} from '../layout/scrollChrome';
import {usePagingLock} from '../layout/PagingBoundary';
import {LibraryCategories, categoryRowHeight} from './LibraryCategories';
import {useUserProfile} from '../features/profile/UserProfileContext';
import {useItemPresence, useItemReducedMotion} from '../layout/itemListMotion';

const rowGeometry = {rowHeight: 112, lineHeight: 37, fontSize: 28, padding: 16, inset: 0, radius: 30, highlightInset: 0};
const matches = (card: Card, search: string) => `${card.title} ${card.creator ?? ''} ${card.description} ${(card.tags ?? []).join(' ')}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());

function CollectionPage({title, search, onSearch, actionLabel, onAction, onBack, active, children, categories, edgeToEdge = false, contentInset = panelReference.inset, selecting = false, navigationProgress = null}: {
  title: string; search: string; onSearch: (text: string) => void; actionLabel: string; onAction: () => void; onBack?: () => void; active: boolean; children: (chrome: ScrollChromeBinding) => ReactNode;
  categories?: ReactNode; edgeToEdge?: boolean; contentInset?: number; selecting?: boolean; navigationProgress?: Animated.Value | null;
}) {
  const {width} = useWindowDimensions();
  const s = headerScale(width), safe = useSafeAreaInsets();
  const {colors: c} = useAppearance();
  const [searching, setSearching] = useState(false);
  const chrome = useCollectionChrome();
  const headerHeight = (referenceHeader.barHeight + 12 + (categories ? categoryRowHeight : 0)) * s;
  const selectionHeight = (referenceHeader.barHeight + 12) * s;
  const animatedTopInset = useMemo(() => navigationProgress?.interpolate({inputRange: [0, 1], outputRange: [selectionHeight, headerHeight]}), [navigationProgress, headerHeight, selectionHeight]);
  const reset = chrome?.reset;
  const reportScroll = chrome?.onScroll;
  const beginDrag = chrome?.onScrollBeginDrag, endDrag = chrome?.onScrollEndDrag;
  const beginMomentum = chrome?.onMomentumScrollBegin, endMomentum = chrome?.onMomentumScrollEnd;
  const setTopInset = chrome?.setTopInset;
  const registerScroller = chrome?.registerScroller;
  const bottomInset = chrome?.bottomInset ?? 0;
  useLayoutEffect(() => {if (active) setTopInset?.(headerHeight);}, [active, headerHeight, setTopInset]);
  const resetChrome = useCallback(() => {if (active) reset?.();}, [active, reset]);
  const scrollChrome = useMemo<ScrollChromeBinding>(() => ({topInset: selecting ? selectionHeight : headerHeight, ...(animatedTopInset ? {animatedTopInset} : {}), bottomInset, reset: resetChrome,
    registerScroller: scrollTo => active && registerScroller ? registerScroller(scrollTo) : () => {},
    onScroll: event => {if (active && !searching) reportScroll?.(event);},
    onScrollBeginDrag: event => {if (active && !searching) beginDrag?.(event);},
    onScrollEndDrag: event => {if (active && !searching) endDrag?.(event);},
    onMomentumScrollBegin: event => {if (active && !searching) beginMomentum?.(event);},
    onMomentumScrollEnd: event => {if (active && !searching) endMomentum?.(event);},
  }), [headerHeight, selectionHeight, animatedTopInset, selecting, bottomInset, resetChrome, registerScroller, reportScroll, beginDrag, endDrag, beginMomentum, endMomentum, active, searching]);
  useEffect(resetChrome, [resetChrome, searching, search]);
  usePagingLock(active && searching);
  const input = useRef<TextInput>(null);
  const actionWidth = (referenceHeader.height * 2 + referenceHeader.actionGap) * s;
  const closeSearch = useCallback(() => {Keyboard.dismiss(); setSearching(false); onSearch('');}, [onSearch]);
  useEffect(() => {if (!active) input.current?.blur();}, [active]);
  useEffect(() => {
    if (!active || !searching) return;
    const native = Platform.OS === 'android' ? BackHandler.addEventListener('hardwareBackPress', () => {closeSearch(); return true;}) : undefined;
    if (Platform.OS !== 'web') return () => native?.remove();
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape' && !event.defaultPrevented) {event.preventDefault(); event.stopImmediatePropagation(); closeSearch();}};
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, [active, searching, closeSearch]);
  const headerVisible = !selecting && (searching || (chrome?.visible ?? true));
  return <View style={{flex: 1, paddingTop: safe.top, backgroundColor: c.background}}>
    <View style={{flex: 1, overflow: 'hidden'}}>
    <View style={{width: '100%', maxWidth: edgeToEdge ? undefined : panelReference.contentMaxWidth, alignSelf: 'center', flex: 1, paddingHorizontal: edgeToEdge ? 0 : contentInset * s}}>
      {children(scrollChrome)}
    </View>
    <Animated.View testID="collection-header" pointerEvents={headerVisible ? 'auto' : 'none'} aria-hidden={!headerVisible} accessibilityElementsHidden={!headerVisible}
      importantForAccessibility={headerVisible ? 'auto' : 'no-hide-descendants'} style={{position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: c.background,
        opacity: navigationProgress ?? 1,
        transform: [{translateY: Animated.add(chrome?.progress.interpolate({inputRange: [0, 1], outputRange: [-headerHeight, 0]}) ?? 0,
          navigationProgress?.interpolate({inputRange: [0, 1], outputRange: [selectionHeight - headerHeight, 0]}) ?? 0)}]}}>
      <View style={{height: headerHeight, paddingBottom: 12 * s}}>
      <View style={{width: '100%', maxWidth: panelReference.contentMaxWidth, alignSelf: 'center', height: referenceHeader.barHeight * s, paddingHorizontal: panelReference.inset * s, flexDirection: 'row', alignItems: 'center'}}>
        {searching ? <>
          <HeaderButton width={width} testID="collection-search-close" icon="back" label="검색 닫기" onPress={closeSearch} variant="plain"/>
          <TextInput ref={input} testID="collection-search-input" accessibilityLabel={`${title} 검색`} placeholder={`${title} 검색`} placeholderTextColor={c.placeholder}
            value={search} onChangeText={onSearch} autoFocus autoCorrect={false} autoCapitalize="none" returnKeyType="search" onSubmitEditing={() => Keyboard.dismiss()}
            selectionColor="#3096EB" underlineColorAndroid="transparent" style={{flex: 1, minWidth: 0, height: referenceHeader.height * s, paddingVertical: 0, paddingHorizontal: 12 * s, fontSize: 28 * s, color: c.text, includeFontPadding: false}}/>
          {!!search && <HeaderButton width={width} testID="collection-search-clear" icon="close" label="검색어 지우기" onPress={() => {onSearch(''); input.current?.focus();}} variant="plain"/>}
        </> : <>
          {onBack ? <>
            <HeaderButton width={width} icon="back" label="채팅 목록으로 돌아가기" onPress={onBack} variant="plain"/>
            <View pointerEvents="none" style={{position: 'absolute', left: actionWidth, right: actionWidth, top: 0, bottom: 0, justifyContent: 'center'}}>
              <Text testID="collection-title" accessibilityRole="header" numberOfLines={1} style={{textAlign: 'center', color: c.text, fontSize: 32 * s, lineHeight: 44 * s, fontWeight: '500', includeFontPadding: false}}>{title}</Text>
            </View>
            <View style={{flex: 1}}/>
          </> : <Text testID="collection-title" accessibilityRole="header" numberOfLines={1} style={{flex: 1, color: c.text, fontSize: referencePageTitle.fontSize * s,
            lineHeight: referencePageTitle.lineHeight * s, fontWeight: referencePageTitle.fontWeight, includeFontPadding: false}}>{title}</Text>}
          <View style={{flexDirection: 'row', gap: referenceHeader.actionGap * s}}>
            <HeaderButton width={width} testID="collection-search" icon="search" label={`${title} 검색`} onPress={() => setSearching(true)} variant="plain"/>
            <HeaderButton width={width} testID="collection-add" icon="plus" label={actionLabel} onPress={onAction} variant="plain"/>
          </View>
        </>}
      </View>
      {categories}
      </View>
    </Animated.View>
    </View>
  </View>;
}

export function CardsCollection({workspace: w, kind, active, startChat}: {workspace: Workspace; kind: 'library' | 'create'; active: boolean; startChat: (card: Card) => Promise<void>}) {
  const {colors: c} = useAppearance();
  const [search, setSearch] = useState('');
  const [inspected, setInspected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const reduced = useItemReducedMotion();
  // Let the selection controls finish their existing exit, then bring both bars
  // and the space above the cards back on one uninterrupted timeline.
  const navigation = useItemPresence(!selecting, reduced || selecting);
  const navigationProgress = kind === 'library' ? navigation.progress : null;
  useCollectionSelection(active, selecting, navigationProgress);
  const folders = useSyncExternalStore(w.cardFolders.subscribe, w.cardFolders.snapshot);
  const {value: profile} = useUserProfile();
  const {width} = useWindowDimensions();
  const s = headerScale(width);
  const collection = useMemo(() => kind === 'library' ? libraryCards(w.cards) : createdCards(w.cards), [kind, w.cards]);
  const categoryId = category && folders.value.folders.some(folder => folder.id === category) ? category : null;
  const filtered = kind === 'library' ? categoryCards(collection, folders.value, categoryId) : collection;
  const selectedCard = collection.find(card => card.id === inspected);
  useEffect(() => {if (!active) setInspected(null);}, [active]);
  const run = (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    void action().catch(w.notifications.report).finally(() => setBusy(false));
  };
  const add = () => run(async () => {
    if (kind === 'create') {await w.createStudio(); return;}
    const text = await pickCardFile();
    if (text) await w.importLibrary(text);
  });
  const exportCard = async (id: string) => {
    if (!w.runtime.authoring) throw new Error('카드 저장소를 불러오지 못했어요.');
    const card = await w.runtime.repo.getCard(id);
    const file = await exportCardBundle(card, w.runtime.authoring);
    if (await saveCardFile(file.filename, file.contents, true)) w.notifications.inform('카드를 내보냈어요.');
  };
  return <>
    <CollectionPage title={kind === 'library' ? '서재' : '생성'} search={search} onSearch={setSearch} actionLabel={kind === 'library' ? '카드 가져오기' : '새 카드 만들기'} onAction={add} active={active} selecting={selecting} navigationProgress={navigationProgress}
      edgeToEdge={kind === 'library'} categories={kind === 'library' ? <LibraryCategories library={w.cardFolders} value={folders.value} selected={categoryId} onSelect={setCategory} scale={s} active={active}
        onRemove={async id => {await w.cardActions.remove([], {scope: w.cardFolders.scope, folderIds: [id]}); await w.cardFolders.refresh();}}/> : undefined}>{scrollChrome =>
      <ManagedItemList scope="card" scale={s} geometry={kind === 'library' ? {...rowGeometry, radius: 0} : rowGeometry} backgroundColor={c.background} items={filtered.filter(card => matches(card, search))} allItems={collection}
        scrollChrome={scrollChrome} hideRootBreadcrumb rootLabel={kind === 'library' ? '서재' : '생성'}
        {...(kind === 'library' ? {selectionVariant: 'page' as const, onSelectionChange: setSelecting} : {})}
        {...(kind === 'library' ? {categoryId, grid: {columns: 3, cover: (card: Card, width: number, height: number) => <CardCover card={card} width={width} height={height} radius={0}/>, byline: (card: Card) => cardCreatorName(card, profile.name)}} : {})}
        actions={{...w.cardActions, ...(kind === 'library' ? {export: exportCard} : {})}} library={w.cardFolders} search={search} active={active} resetKey={`${kind}:${categoryId}:${search}`}
        empty={search ? '검색 결과가 없어요.' : categoryId ? '아직 이 분류에 담은 카드가 없어요.' : kind === 'library' ? '가져오거나 완성한 카드가 여기에 모여요.' : '새 카드를 만들고 여기서 이어서 작업해요.'}
        report={w.notifications.report} onOpen={card => {scrollChrome.reset(); if (kind === 'create') run(() => w.openStudio(card.id)); else setInspected(card.id);}}
        openLabel={card => `${card.title} ${kind === 'create' ? '편집' : '카드 열기'}`}
        subtitle={card => kind === 'create' ? card.studioDraft ? '제작 중' : '완성한 카드' : card.description || (card.tags?.length ? card.tags.join(' · ') : card.origin === 'imported' ? '가져온 카드' : '내 카드')}
        leading={card => <View style={{marginRight: 20 * s}}><CardThumbnail cover={card.cover} assetId={card.coverAssetId} size={72 * s}/></View>}/>}
    </CollectionPage>
    {active && selectedCard && <CardLibraryActions card={selectedCard} onClose={() => setInspected(null)} startChat={() => startChat(selectedCard)} edit={() => w.openStudio(selectedCard.id)} exportCard={() => exportCard(selectedCard.id)} report={w.notifications.report}/>}
  </>;
}

function CardLibraryActions({card, onClose, startChat, edit, exportCard, report}: {card: Card; onClose: () => void; startChat: () => Promise<void>; edit: () => Promise<void>; exportCard: () => Promise<void>; report: (error: unknown) => void}) {
  const next = useRef<(() => Promise<void>) | null>(null);
  return <SettingsSheet title={card.title} {...(card.description ? {caption: card.description} : {})} onClose={() => {onClose(); const action = next.current; next.current = null; if (action) void action().catch(report);}}>{close => <>
    {([{label: '새 채팅 시작', action: startChat}, {label: '카드 편집', action: edit}, {label: '내보내기', action: exportCard}]).map(item => <SettingsChoice key={item.label} label={item.label} selected={false} onPress={() => {next.current = item.action; close();}}/>)}
  </>}</SettingsSheet>;
}

export function ChatsCollection({workspace: w, active, startChat, openConversation}: {workspace: Workspace; active: boolean; startChat: (card?: Card) => Promise<void>; openConversation: (room: Conversation) => Promise<void>}) {
  const [cardId, setCardId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const card = w.cards.find(item => item.id === cardId);
  const list = useRef<FlatList>(null);
  useScrollChromeTarget(useCollectionChrome(), active && !card, offset => list.current?.scrollToOffset({offset, animated: false}));
  const {colors: c} = useAppearance();
  const {width} = useWindowDimensions();
  const s = headerScale(width);
  const back = () => {setCardId(null); setSearch('');};
  useEffect(() => {if (!active) setCreateOpen(false);}, [active]);
  useEffect(() => {if (cardId && !card) back();}, [cardId, card]);
  const allRooms = w.history.items.filter(room => room.cardId === card?.id);
  const groups = conversationCards(w.cards, w.history.items, search);
  return <>
    <CollectionPage key={card?.id ?? 'chats'} title={card?.title ?? '채팅'} search={search} onSearch={setSearch} actionLabel={card ? `${card.title} 새 채팅` : '새 채팅'} active={active} contentInset={panelReference.inset - rowGeometry.padding}
      {...(card ? {onBack: back} : {})} onAction={() => card ? void startChat(card).catch(w.notifications.report) : setCreateOpen(true)}>{scrollChrome =>
      card ? <ManagedItemList key={card.id} scope="history" scale={s} backgroundColor={c.background} scrollChrome={scrollChrome} items={allRooms.filter(room => `${room.title} ${room.preview ?? ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))}
        allItems={allRooms} actions={w.history} library={w.history.folderLibrary(card.id)} search={search} active={active} onBack={back} resetKey={`${card.id}:${search}`} empty={search ? '검색 결과가 없어요.' : '아직 채팅이 없어요.'}
        onOpen={room => {void openConversation(room).catch(w.notifications.report);}} report={w.notifications.report}
        geometry={rowGeometry} subtitle={room => room.preview || '새로운 대화'}/> : <FlatList ref={list} data={groups} keyExtractor={item => item.card.id} showsVerticalScrollIndicator={false}
        onScroll={scrollChrome.onScroll} scrollEventThrottle={16} contentContainerStyle={{paddingTop: scrollChrome.topInset, paddingBottom: scrollChrome.bottomInset + 16, flexGrow: 1}} keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={scrollChrome.onScrollBeginDrag} onScrollEndDrag={scrollChrome.onScrollEndDrag}
        onMomentumScrollBegin={scrollChrome.onMomentumScrollBegin} onMomentumScrollEnd={scrollChrome.onMomentumScrollEnd}
        ListEmptyComponent={<Text style={{padding: 16 * s, paddingTop: 30 * s, color: c.muted, fontSize: 23 * s, lineHeight: 34 * s}}>{search ? '검색 결과가 없어요.' : '시작한 채팅이 카드별로 모여요.'}</Text>}
        renderItem={({item}) => <RowPressable accessibilityRole="button" accessibilityLabel={`${item.card.title} 채팅 ${item.count}개`} onPress={() => {setCardId(item.card.id); setSearch('');}} radius={30 * s}
          contentStyle={{minHeight: 116 * s, paddingHorizontal: 16 * s, flexDirection: 'row', alignItems: 'center', gap: 20 * s}}>
          <CardThumbnail cover={item.card.cover} assetId={item.card.coverAssetId} size={72 * s}/>
          <View style={{flex: 1, minWidth: 0, gap: 5 * s}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 10 * s}}><Text numberOfLines={1} style={{flex: 1, color: c.text, fontSize: 28 * s, lineHeight: 37 * s}}>{item.card.title}</Text><Text style={{color: c.muted, fontSize: 21 * s}}>{item.count}</Text></View>
            <Text numberOfLines={1} style={{color: c.muted, fontSize: 21 * s, lineHeight: 28 * s}}>{item.latest.preview || item.latest.title}</Text>
          </View>
          <SettingsIcon name="chevron" size={22 * s} color={c.placeholder}/>
        </RowPressable>}/>}
    </CollectionPage>
    {active && createOpen && <NewChatChoice cards={libraryCards(w.cards)} onClose={() => setCreateOpen(false)} startChat={startChat} report={w.notifications.report}/>}
  </>;
}

function NewChatChoice({cards, onClose, startChat, report}: {cards: readonly Card[]; onClose: () => void; startChat: (card?: Card) => Promise<void>; report: (error: unknown) => void}) {
  const next = useRef<(() => Promise<void>) | null>(null);
  return <SettingsSheet title="새 채팅" onClose={() => {onClose(); const action = next.current; next.current = null; if (action) void action().catch(report);}}>{close => <>
    <SettingsChoice label="일반 채팅" selected={false} onPress={() => {next.current = () => startChat(); close();}}/>
    {cards.map(card => <SettingsChoice key={card.id} label={card.title} selected={false} onPress={() => {next.current = () => startChat(card); close();}}/>)}
  </>}</SettingsSheet>;
}
