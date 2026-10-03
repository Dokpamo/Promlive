import {useEffect, useRef, useState, type ReactNode} from 'react';
import {AppState, FlatList, Pressable, ScrollView, Text, View} from 'react-native';
import {usePalette} from '../Theme';
import {NavigationButton, tabLabels, type Tab} from '../Navigation';
import {FilterChips} from '../FilterChips';
import {SearchField} from '../SearchField';
import {ContentRow} from '../ContentRow';
import {PreviewArtwork, previewArtworkRatio} from '../PreviewArtwork';
import {libraryFilters} from '../swipeNavigation';
import {creationFilters} from '../creationPreview';
import {filteredWorkCards, type CardContent, type LibraryCard, type WorkCard} from '../cardWorkspace';
import {formatChatTimestamp} from '../chatTimestamp';
import type {ChatRow, ScreenView} from '../screenState';
import type {ScreenMemory} from '../ScreenMemory';
import {usePlainScrollMemory} from '../usePlainScrollMemory';
import {desktopMetrics} from './desktopMetrics';
import {HoverPressable} from './DesktopFeedback';

export const desktopScale = desktopMetrics.scale;
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase();
type SearchProps = {view: ScreenView; search: (scope: 'library' | 'chats' | 'create', change: Partial<{open: boolean; query: string}>) => void};

export function DesktopHeader({tab, children}: {tab: Tab; children?: ReactNode}) {
  const colors = usePalette();
  return <View testID="ui-desktop-header" style={{height: 64, flexShrink: 0, flexDirection: 'row', alignItems: 'center', paddingLeft: 28, paddingRight: 16}}>
    <Text accessibilityRole="header" style={{...desktopMetrics.heading, fontWeight: '700', color: colors.foreground, flex: 1}}>{tabLabels[tab]}</Text>{children}
  </View>;
}
function SearchToggle({scope, view, search}: SearchProps & {scope: 'library' | 'chats' | 'create'}) {
  return <NavigationButton testID={`ui-${scope}-search-button`} icon="search" label={`${tabLabels[scope]} 검색`} scale={desktopScale}
    expanded={view.searches[scope].open} onPress={() => search(scope, view.searches[scope].open ? {open: false, query: ''} : {open: true})}/>;
}
function Search({scope, view, search}: SearchProps & {scope: 'library' | 'chats' | 'create'}) {
  return view.searches[scope].open ? <SearchField scope={scope} query={view.searches[scope].query}
    onQueryChange={query => search(scope, {query})} onClose={() => search(scope, {open: false, query: ''})}/> : null;
}
export function DesktopEmpty({children}: {children: string}) {
  const colors = usePalette();
  return <View style={{flex: 1, minHeight: 180, padding: 32, alignItems: 'center', justifyContent: 'center'}}>
    <Text style={{...desktopMetrics.body, textAlign: 'center', color: colors.secondaryForeground}}>{children}</Text>
  </View>;
}
export function DesktopLibrary({items, width, columns, memory, view, search, onOpen}: SearchProps & {
  items: LibraryCard[]; width: number; columns: number; memory: ScreenMemory; onOpen: (id: string) => void;
}) {
  const query = normalize(view.searches.library.query.trim());
  const filtered = items.filter(card => (view.libraryFilter === 'all' || card.activity === view.libraryFilter)
    && normalize(`${card.title} ${card.character} ${card.creator}`).includes(query));
  return <>
    <DesktopHeader tab="library"><SearchToggle scope="library" view={view} search={search}/></DesktopHeader>
    <FilterChips scope="library" items={libraryFilters} selected={view.libraryFilter} scale={desktopScale} horizontalInset={28}
      onChange={libraryFilter => memory.updateView(current => ({...current, libraryFilter}))}/>
    <Search scope="library" view={view} search={search}/>
    <LibraryGrid key={`${view.libraryFilter}:${columns}`} items={filtered} width={width} columns={columns} memory={memory} filter={view.libraryFilter} onOpen={onOpen}/>
  </>;
}
function LibraryGrid({items, width, columns, memory, filter, onOpen}: {items: LibraryCard[]; width: number; columns: number; memory: ScreenMemory; filter: ScreenView['libraryFilter']; onOpen: (id: string) => void}) {
  const colors = usePalette(), list = useRef<FlatList<LibraryCard>>(null);
  const scope = `library:${filter}` as const;
  const saved = useRef(memory.getScroll(scope).offset).current;
  const restoring = useRef(saved > 0), size = useRef({viewport: 0, content: 0});
  const cardWidth = (width - 56 - (columns - 1) * 20) / columns;
  function restore() {
    if (!restoring.current || !size.current.viewport || !size.current.content) return;
    list.current?.scrollToOffset({offset: Math.min(saved, Math.max(0, size.current.content - size.current.viewport)), animated: false});
    restoring.current = false;
  }
  return <FlatList ref={list} testID="ui-library-grid" data={items} numColumns={columns} keyExtractor={card => card.id}
    style={{flex: 1, minHeight: 0}} contentContainerStyle={{paddingHorizontal: 28, paddingTop: 16, paddingBottom: 32, gap: 24}}
    columnWrapperStyle={columns > 1 ? {gap: 20} : undefined} showsVerticalScrollIndicator={false}
    onLayout={event => {size.current.viewport = event.nativeEvent.layout.height; restore();}}
    onContentSizeChange={(_w, h) => {size.current.content = h; restore();}} scrollEventThrottle={32}
    onScroll={event => {if (!restoring.current) {const e = event.nativeEvent, maxOffset = Math.max(0, e.contentSize.height - e.layoutMeasurement.height);
      memory.rememberScroll(scope, {offset: Math.max(0, Math.min(e.contentOffset.y, maxOffset)), maxOffset, hidden: 0, height: 0});}}}
    ListEmptyComponent={<DesktopEmpty>조건에 맞는 카드가 없어요.</DesktopEmpty>}
    renderItem={({item}) => <HoverPressable feedback="border" outlineInset={-5} testID={`ui-card-${item.id}`} accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.creator}`} onPress={() => onOpen(item.id)} style={{width: cardWidth, borderRadius: 12}}>
      <View style={{width: cardWidth, height: cardWidth * 4 / 3, borderRadius: 10, backgroundColor: colors.surface, overflow: 'hidden'}}>
        <PreviewArtwork tile={item.tile} width={cardWidth} height={cardWidth * 4 / 3}/>
      </View>
      <Text numberOfLines={2} style={{...desktopMetrics.body, fontWeight: '600', marginTop: 11, color: colors.foreground}}>{item.title}</Text>
      <Text numberOfLines={1} style={{...desktopMetrics.secondary, marginTop: 4, color: colors.secondaryForeground}}>{item.creator}</Text>
    </HoverPressable>}/>;
}
function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {const timer = setInterval(() => setNow(Date.now()), 60_000);
    const listener = AppState.addEventListener('change', state => {if (state === 'active') setNow(Date.now());});
    return () => {clearInterval(timer); listener.remove();};}, []);
  return now;
}
export function DesktopChats({chats, memory, view, search, onOpen, compact}: SearchProps & {chats: ChatRow[]; memory: ScreenMemory; onOpen: (id: string) => void; compact: boolean}) {
  const now = useNow(), scroll = useRef<ScrollView>(null), scrolling = usePlainScrollMemory(memory, 'chats', scroll);
  const query = normalize(view.searches.chats.query.trim());
  const filtered = chats.filter(chat => normalize(`${chat.title} ${chat.character} ${chat.lastAssistantMessage}`).includes(query));
  return <>
    <DesktopHeader tab="chats"><SearchToggle scope="chats" view={view} search={search}/></DesktopHeader>
    <Search scope="chats" view={view} search={search}/>
    <ScrollView ref={scroll} {...scrolling} testID="ui-chats-list" style={{flex: 1}} contentContainerStyle={{paddingTop: 8, paddingBottom: 24}}>
      {filtered.map(chat => <ContentRow key={chat.id} scope="chat" id={chat.id} title={chat.title} subtitle={chat.lastAssistantMessage}
        timestamp={formatChatTimestamp(chat.lastChatAt, now)} tile={chat.tile} compact={compact} selected={chat.id === view.chatId}
        accessibilityLabel={`${chat.title}, ${chat.lastAssistantMessage}`} onPress={() => onOpen(chat.id)}/>)}
      {!filtered.length && <DesktopEmpty>채팅이 없어요. 서재에서 카드를 열어 대화를 시작해 보세요.</DesktopEmpty>}
    </ScrollView>
  </>;
}
export function DesktopCreation({cards, memory, view, search, onOpen, onCreate}: SearchProps & {cards: WorkCard[]; memory: ScreenMemory; onOpen: (id: string) => void; onCreate: () => void}) {
  const now = useNow(), scroll = useRef<ScrollView>(null), scrolling = usePlainScrollMemory(memory, `create:${view.creationFilter}`, scroll);
  const filtered = filteredWorkCards(cards, view.creationFilter, view.searches.create.query);
  return <>
    <DesktopHeader tab="create"><SearchToggle scope="create" view={view} search={search}/>
      <NavigationButton testID="ui-header-action" icon="plus" label="새 카드 만들기" scale={desktopScale} onPress={onCreate}/></DesktopHeader>
    <FilterChips scope="create" items={creationFilters} selected={view.creationFilter} scale={desktopScale} horizontalInset={28}
      onChange={creationFilter => memory.updateView(current => ({...current, creationFilter}))}/>
    <Search scope="create" view={view} search={search}/>
    <ScrollView ref={scroll} {...scrolling} testID="ui-create-list" style={{flex: 1}} contentContainerStyle={{paddingTop: 8, paddingBottom: 24, maxWidth: 900}}>
      {filtered.map(card => <ContentRow key={card.id} scope="creation" id={card.id} title={card.draft.title || '제목 없는 카드'}
        subtitle={`${card.origin === 'external' ? '외부 카드 · ' : ''}${card.working ? '작업 중' : '완성'} · ${card.draft.summary}`}
        timestamp={formatChatTimestamp(card.updatedAt, now)} tile={card.draft.tile} accessibilityLabel={`${card.draft.title || '제목 없는 카드'} 편집`} onPress={() => onOpen(card.id)}/>)}
      {!filtered.length && <DesktopEmpty>조건에 맞는 제작물이 없어요.</DesktopEmpty>}
    </ScrollView>
  </>;
}
export function DesktopCardPreview({content, width}: {content: CardContent; width: number}) {
  const colors = usePalette(), imageWidth = width - 48;
  return <ScrollView testID="ui-desktop-card-preview" style={{width, flexGrow: 0, borderLeftWidth: 1, borderLeftColor: colors.separator}} contentContainerStyle={{padding: 24, paddingTop: 84, gap: 12}}>
    <View style={{width: imageWidth, height: imageWidth * 4 / 3, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surface}}><PreviewArtwork tile={content.tile} width={imageWidth} height={imageWidth * 4 / 3}/></View>
    <Text numberOfLines={2} style={{fontSize: 17, fontWeight: '600', lineHeight: 27, color: colors.foreground}}>{content.title || '제목 없는 카드'}</Text>
    <Text numberOfLines={1} style={{fontSize: 14, color: colors.secondaryForeground}}>{content.creator}</Text>
    <Text style={{fontSize: 15, lineHeight: 24, color: colors.foreground}}>{content.summary}</Text>
    <Text style={{fontSize: 14, lineHeight: 22, color: colors.secondaryForeground}}>{content.tags.map(tag => `#${tag}`).join('  ')}</Text>
  </ScrollView>;
}
export function DesktopCardDetail({card, width, memory, onClose, onEdit, onImage, onChat}: {card: LibraryCard; width: number; memory: ScreenMemory; onClose: () => void; onEdit: () => void; onImage: (index?: number) => void; onChat: () => void}) {
  const colors = usePalette(), scroll = useRef<ScrollView>(null), scrolling = usePlainScrollMemory(memory, 'detail', scroll);
  const split = width >= 800, coverWidth = split ? Math.min(360, width * .36) : Math.min(340, width - 56);
  return <>
    <View style={{height: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16}}>
      <NavigationButton testID="ui-card-detail-back" icon="back" label="서재로 돌아가기" scale={desktopScale} onPress={onClose}/>
      <NavigationButton testID="ui-card-detail-edit" icon="compose" label="카드 편집" scale={desktopScale} onPress={onEdit}/>
    </View>
    <ScrollView ref={scroll} {...scrolling} testID="ui-card-detail" style={{flex: 1}} contentContainerStyle={{paddingHorizontal: 28, paddingBottom: 40, alignItems: 'center'}}>
      <View style={{width: '100%', maxWidth: 1100, flexDirection: split ? 'row' : 'column', gap: 36, alignItems: split ? 'flex-start' : 'center'}}>
        <HoverPressable feedback="border" testID="ui-card-detail-cover" accessibilityRole="button" accessibilityLabel="대표 이미지 보기" onPress={() => onImage()}
          style={{width: coverWidth, height: coverWidth / previewArtworkRatio(card.tile), borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface}}>
          <PreviewArtwork tile={card.tile} width={coverWidth} height={coverWidth / previewArtworkRatio(card.tile)} fullImage/>
        </HoverPressable>
        <View style={{flex: split ? 1 : undefined, width: split ? undefined : '100%', minWidth: 0, gap: 22}}>
          <View style={{gap: 10}}><Text style={{fontSize: 26, lineHeight: 34, fontWeight: '700', color: colors.foreground}}>{card.title}</Text>
            <Text style={{fontSize: 14, color: colors.secondaryForeground}}>{card.creator}</Text></View>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>{card.tags.map(tag => <View key={tag} style={{borderRadius: 20, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8}}>
            <Text style={{fontSize: 14, color: colors.foreground}}>{tag}</Text></View>)}</View>
          <Text style={{fontSize: 15, lineHeight: 24, color: colors.foreground}}>{card.summary}</Text>
          <Pressable testID="ui-card-start-chat" accessibilityRole="button" accessibilityLabel="대화 시작" onPress={onChat} style={{height: 44, borderRadius: 14, backgroundColor: colors.selectedBackground, alignItems: 'center', justifyContent: 'center'}}>
            <Text style={{fontSize: 14, fontWeight: '600', color: colors.selectedForeground}}>대화 시작</Text></Pressable>
          <Text style={{fontSize: 17, fontWeight: '600', color: colors.foreground}}>갤러리</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 10}}>
            {card.gallery.map((picture, index) => <HoverPressable feedback="border" key={picture.id} testID={`ui-card-gallery-${index}`} accessibilityRole="button" accessibilityLabel={picture.title} onPress={() => onImage(index)}
              style={{width: 124, height: 140, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surface}}><PreviewArtwork tile={picture.tile} width={124} height={140}/></HoverPressable>)}
          </ScrollView>
          <Text style={{fontSize: 17, fontWeight: '600', color: colors.foreground}}>인트로</Text>
          <Text style={{fontSize: 15, lineHeight: 24, color: colors.foreground}}>{card.introduction}</Text>
          {!!card.guide && <><Text style={{fontSize: 17, fontWeight: '600', color: colors.foreground}}>가이드</Text><Text style={{fontSize: 15, lineHeight: 24, color: colors.foreground}}>{card.guide}</Text></>}
        </View>
      </View>
    </ScrollView>
  </>;
}
