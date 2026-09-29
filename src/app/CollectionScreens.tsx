import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode} from 'react';
import {Animated, BackHandler, Keyboard, Platform, Text, TextInput, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Workspace} from './workspace';
import {cardCreatorName, categoryCards, createdCards, libraryCards} from './collections';
import type {Card} from '../features/cards/model';
import {CardThumbnail} from '../features/cards/CardThumbnail';
import {SettingsChoice, SettingsSheet} from '../features/settings/SettingsLayout';
import {headerScale} from '../layout/metrics';
import {ManagedItemList} from '../layout/ManagedItemList';
import {exportCardBundle} from '../features/authoring/cardBundle';
import {pickCardFile, saveCardFile} from '../adapters/files/cardFiles';
import {useCollectionChrome, useCollectionSelection} from './NavigationChrome';
import type {ScrollChromeBinding} from '../layout/scrollChrome';
import {usePagingLock} from '../layout/PagingBoundary';
import {LibraryCategories, categoryRowHeight} from './LibraryCategories';
import {CategoryPager} from './CategoryPager';
import {useUserProfile} from '../features/profile/UserProfileContext';
import {useItemPresence, useItemReducedMotion} from '../layout/itemListMotion';
import {ActionButton, SearchField, ui, useDesign} from '../design/foundation';
import {UserAvatar} from '../features/profile/UserAvatar';
import {CollectionHeader, collectionHeaderGeometry} from './CollectionHeader';
import {navigationMetrics} from '../design/navigationMetrics';

const rowGeometry = {rowHeight: 158, lineHeight: 36, fontSize: 26, padding: 28, inset: 0, radius: 0, highlightInset: 0};
const matches = (card: Card, search: string) => `${card.title} ${card.creator ?? ''} ${card.description} ${(card.tags ?? []).join(' ')}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());

function CollectionPage({title, search, onSearch, actionLabel, onAction, onBack, active, children, categories, showSearch = true, selecting = false, navigationProgress = null}: {
  title: string; search: string; onSearch: (text: string) => void; actionLabel: string; onAction: () => void; onBack?: () => void; active: boolean; children: (chrome: ScrollChromeBinding) => ReactNode;
  categories?: ReactNode; showSearch?: boolean; selecting?: boolean; navigationProgress?: Animated.Value | null;
}) {
  const {s, color} = useDesign(), safe = useSafeAreaInsets();
  const [focused, setFocused] = useState(false);
  const chrome = useCollectionChrome();
  const input = useRef<TextInput>(null);
  const headerHeight = (navigationMetrics.headerHeight + (showSearch ? ui.search + collectionHeaderGeometry.searchTop + collectionHeaderGeometry.searchBottom : 0) + (categories ? categoryRowHeight : 0)) * s;
  const selectionHeight = ui.header * s;
  const animatedTopInset = useMemo(() => navigationProgress?.interpolate({inputRange: [0, 1], outputRange: [selectionHeight, headerHeight]}), [navigationProgress, headerHeight, selectionHeight]);
  const reset = chrome?.reset;
  const resetChrome = useCallback(() => {if (active) reset?.();}, [active, reset]);
  const scrollChrome = useMemo<ScrollChromeBinding>(() => ({topInset: selecting ? selectionHeight : headerHeight, ...(animatedTopInset ? {animatedTopInset} : {}), bottomInset: chrome?.bottomInset ?? 0,
    reset: resetChrome, registerScroller: () => () => {}, onScroll: () => {}, onScrollBeginDrag: () => {}, onScrollEndDrag: () => {}, onMomentumScrollBegin: () => {}, onMomentumScrollEnd: () => {},
  }), [headerHeight, selectionHeight, animatedTopInset, selecting, chrome?.bottomInset, resetChrome]);
  usePagingLock(active && focused);
  useEffect(() => {if (!active) input.current?.blur();}, [active]);
  useEffect(() => {
    if (!active || !focused) return;
    const closeSearch = () => {input.current?.blur(); Keyboard.dismiss(); setFocused(false); return true;};
    const native = Platform.OS === 'android' ? BackHandler.addEventListener('hardwareBackPress', closeSearch) : undefined;
    if (Platform.OS !== 'web') return () => native?.remove();
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape' && !event.defaultPrevented) {event.preventDefault(); event.stopImmediatePropagation(); closeSearch();}};
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, [active, focused]);
  return <View style={{flex: 1, paddingTop: safe.top, backgroundColor: color.background}}>
    <View style={{flex: 1, overflow: 'hidden'}}>
      {children(scrollChrome)}
      <Animated.View testID="collection-header" pointerEvents={selecting ? 'none' : 'auto'} aria-hidden={selecting} accessibilityElementsHidden={selecting}
        importantForAccessibility={selecting ? 'no-hide-descendants' : 'auto'} style={{position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: color.background,
          opacity: navigationProgress ?? 1, transform: [{translateY: navigationProgress?.interpolate({inputRange: [0, 1], outputRange: [-24 * s, 0]}) ?? 0}]}}>
        <CollectionHeader title={title} search={search} onSearch={onSearch} actionLabel={actionLabel} onAction={onAction} {...(onBack ? {onBack} : {})}
          showSearch={showSearch} categories={categories} inputRef={input} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}/>
      </Animated.View>
    </View>
  </View>;
}

export function CardsCollection({workspace: w, kind, active, startChat}: {workspace: Workspace; kind: 'library' | 'create'; active: boolean; startChat: (card: Card) => Promise<void>}) {
  const {color: c} = useDesign();
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  usePagingLock(active && searchFocused);
  const [inspected, setInspected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const reduced = useItemReducedMotion();
  // Let the selection controls finish their existing exit, then bring both bars
  // and the space above the cards back on one uninterrupted timeline.
  const navigation = useItemPresence(!selecting, reduced || selecting);
  const navigationProgress = navigation.progress;
  useCollectionSelection(active, selecting, navigationProgress);
  const folders = useSyncExternalStore(w.cardFolders.subscribe, w.cardFolders.snapshot);
  const {value: profile} = useUserProfile();
  const {width} = useWindowDimensions();
  const s = headerScale(width);
  const collection = useMemo(() => kind === 'library' ? libraryCards(w.cards) : createdCards(w.cards), [kind, w.cards]);
  const categoryId = category && folders.value.folders.some(folder => folder.id === category) ? category : null;
  const categoryIds = useMemo(() => [null, ...folders.value.folders.map(folder => folder.id)], [folders.value.folders]);
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
    <CategoryPager ids={categoryIds} selected={categoryId} onSelect={setCategory} enabled={active && !selecting && !selectedCard && !busy}>{pages =>
    <CollectionPage title={kind === 'library' ? '서재' : '생성'} search={search} onSearch={setSearch} actionLabel={kind === 'library' ? '카드 가져오기' : '새 카드 만들기'} onAction={add} active={active} selecting={selecting} navigationProgress={navigationProgress}
      showSearch={kind === 'library'} categories={kind === 'library' ? <LibraryCategories library={w.cardFolders} value={folders.value} selected={categoryId} onSelect={setCategory} scale={s} active={active}
        onRemove={async id => {await w.cardActions.remove([], {scope: w.cardFolders.scope, folderIds: [id]}); await w.cardFolders.refresh();}}/> : undefined}>{scrollChrome => pages((pageCategory, pageActive) =>
      <ManagedItemList scope="card" scale={s} geometry={{...rowGeometry, radius: 0}} backgroundColor={c.background} items={categoryCards(collection, folders.value, pageCategory).filter(card => matches(card, search))} allItems={collection}
        scrollChrome={scrollChrome} categoryId={pageCategory} hideRootBreadcrumb rootLabel={kind === 'library' ? '서재' : '생성'}
        selectionVariant="page" {...(pageActive ? {onSelectionChange: setSelecting} : {})}
        intro={kind === 'create' ? <>
          <CreatorProfile cards={collection} categories={folders.value.folders.length} onCreate={add} onImport={() => run(async () => {const text = await pickCardFile(); if (text) await w.importStudio(text);})}/>
          <View style={{paddingHorizontal: ui.inset * s, paddingBottom: 18 * s}}><SearchField value={search} onChange={setSearch} label="생성 검색" testID="creation-search-input" onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}/></View>
          <LibraryCategories library={w.cardFolders} value={folders.value} selected={categoryId} onSelect={setCategory} scale={s} active={active && pageActive}
            variant="underline"
            onRemove={async id => {await w.cardActions.remove([], {scope: w.cardFolders.scope, folderIds: [id]}); await w.cardFolders.refresh();}}/>
        </> : undefined}
        leading={card => <View style={{height: '100%', paddingTop: 22 * s, marginRight: 22 * s}}><CardThumbnail cover={card.cover} assetId={card.coverAssetId} size={70 * s}/></View>}
        rowContent={card => <CardSummary card={card} creator={cardCreatorName(card, profile.name)} kind={kind} selecting={selecting}/>}
        actions={{...w.cardActions, ...(kind === 'library' ? {export: exportCard} : {})}} library={w.cardFolders} search={search} active={active && pageActive} resetKey={`${kind}:${pageCategory}:${search}`}
        empty={search ? '검색 결과가 없어요.' : pageCategory ? '아직 이 분류에 담은 카드가 없어요.' : kind === 'library' ? '가져오거나 완성한 카드가 여기에 모여요.' : '새 카드를 만들고 여기서 이어서 작업해요.'}
        report={w.notifications.report} onOpen={card => {scrollChrome.reset(); if (kind === 'create') run(() => w.openStudio(card.id)); else setInspected(card.id);}}
        openLabel={card => `${card.title} ${kind === 'create' ? '편집' : '카드 열기'}`}/>)}</CollectionPage>}
    </CategoryPager>
    {active && selectedCard && <CardLibraryActions card={selectedCard} onClose={() => setInspected(null)} startChat={() => startChat(selectedCard)} edit={() => w.openStudio(selectedCard.id)} exportCard={() => exportCard(selectedCard.id)} report={w.notifications.report}/>}
  </>;
}

function CreatorProfile({cards, categories, onCreate, onImport}: {cards: readonly Card[]; categories: number; onCreate: () => void; onImport: () => void}) {
  const {value: profile} = useUserProfile();
  const {s, color} = useDesign();
  return <View testID="creator-profile" style={{paddingHorizontal: ui.inset * s, paddingTop: 6 * s, paddingBottom: 28 * s}}>
    <View style={{flexDirection: 'row', alignItems: 'flex-start', gap: 24 * s, marginBottom: 28 * s}}>
      <View style={{flex: 1, gap: 8 * s, paddingTop: 20 * s}}>
        <Text numberOfLines={1} style={{color: color.text, fontSize: 40 * s, lineHeight: 52 * s, fontWeight: '700'}}>{profile.name}</Text>
        <Text style={{color: color.text, fontSize: 25 * s, lineHeight: 36 * s}}>나의 작업실</Text>
        <Text style={{color: color.muted, fontSize: 23 * s, lineHeight: 34 * s, marginTop: 12 * s}}>작품 {cards.filter(card => !card.studioDraft).length} · 초안 {cards.filter(card => card.studioDraft).length} · 분류 {categories}</Text>
      </View>
      <UserAvatar image={profile.image} size={112 * s}/>
    </View>
    <View style={{flexDirection: 'row', gap: 10 * s}}>
      <ActionButton label="새로 만들기" onPress={onCreate} testID="creation-create"/>
      <ActionButton label="파일 가져오기" onPress={onImport} testID="creation-import"/>
    </View>
  </View>;
}

function CardSummary({card, creator, kind, selecting}: {card: Card; creator: string; kind: 'library' | 'create'; selecting: boolean}) {
  const {s, color} = useDesign();
  return <View style={{flex: 1, height: '100%', minWidth: 0, paddingTop: 20 * s, paddingBottom: 20 * s, borderBottomWidth: .5, borderBottomColor: color.line, gap: 5 * s}}>
    <View style={{flexDirection: 'row', alignItems: 'flex-start', gap: 18 * s}}>
      <View style={{flex: 1, minWidth: 0, gap: 4 * s}}>
        <Text numberOfLines={1} style={{color: color.text, fontSize: 27 * s, lineHeight: 36 * s, fontWeight: '600', includeFontPadding: false}}>{card.title}</Text>
        <Text numberOfLines={1} style={{color: color.muted, fontSize: 24 * s, lineHeight: 32 * s, includeFontPadding: false}}>{creator}{kind === 'create' && card.studioDraft ? ' · 초안' : ''}</Text>
      </View>
      {!selecting && <View pointerEvents="none" style={{minWidth: 128 * s, height: 56 * s, paddingHorizontal: 24 * s, borderRadius: 18 * s, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center'}}>
        <Text style={{color: color.onAccent, fontSize: 24 * s, fontWeight: '600'}}>{kind === 'library' ? '열기' : '편집'}</Text>
      </View>}
    </View>
    <Text numberOfLines={1} style={{color: color.text, fontSize: 23 * s, lineHeight: 33 * s, includeFontPadding: false}}>{card.description || (card.tags?.length ? card.tags.join(' · ') : kind === 'create' ? '이어서 만들기' : '대화 시작하기')}</Text>
  </View>;
}

function CardLibraryActions({card, onClose, startChat, edit, exportCard, report}: {card: Card; onClose: () => void; startChat: () => Promise<void>; edit: () => Promise<void>; exportCard: () => Promise<void>; report: (error: unknown) => void}) {
  const next = useRef<(() => Promise<void>) | null>(null);
  return <SettingsSheet title={card.title} {...(card.description ? {caption: card.description} : {})} onClose={() => {onClose(); const action = next.current; next.current = null; if (action) void action().catch(report);}}>{close => <>
    {([{label: '새 채팅 시작', action: startChat}, {label: '카드 편집', action: edit}, {label: '내보내기', action: exportCard}]).map(item => <SettingsChoice key={item.label} label={item.label} selected={false} onPress={() => {next.current = item.action; close();}}/>)}
  </>}</SettingsSheet>;
}

export {ChatsCollection} from './ChatsCollection';
