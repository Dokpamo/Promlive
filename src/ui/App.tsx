import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode} from 'react';
import {Animated, Keyboard, NativeModules, Platform, Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Header, TabBar, type Tab} from './Navigation';
import {TabPages} from './TabPages';
import {Library} from './Library';
import {Chats} from './Chats';
import {Creation} from './Creation';
import {Settings} from './Settings';
import {CardEditor} from './CardEditor';
import {CardDetail} from './CardDetail';
import {GestureRoot} from './GestureRoot';
import {SwipeSurface} from './SwipeSurface';
import {createBackTransition, createBackUnderlay, type BackTransition, type BackUnderlaySource} from './backTransition';
import {useScreenCorners} from './useScreenCorners';
import {libraryFilters, stepRootView, type RootPageKey, type SwipeDirection} from './swipeNavigation';
import {publishedLibraryCards} from './cardWorkspace';
import {ScreenMemory} from './ScreenMemory';
import {createScreenStorage} from './screenStorage';
import {useScreenMemory} from './useScreenMemory';
import type {LibraryFilter} from './screenState';
import {creationFilters, type CreationFilter} from './creationPreview';
import {colors, navigationScale, uiAppearance} from './tokens';

/** First render uses the local snapshot; background refresh never replaces it with a loader. */
export default function App({memory: provided}: {memory?: ScreenMemory} = {}) {
  const [memory] = useState(() => provided ?? new ScreenMemory(createScreenStorage()));
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    NativeModules.PromliveSystemBars?.setDarkIcons(uiAppearance === 'light');
    const frame = requestAnimationFrame(() => NativeModules.PromliveStartup?.ready(uiAppearance));
    return () => cancelAnimationFrame(frame);
  }, []);
  return <GestureRoot style={{flex: 1}}><SafeAreaProvider style={{flex: 1, backgroundColor: colors.background}}>
    <StatusBar barStyle={uiAppearance === 'light' ? 'dark-content' : 'light-content'}/>
    <Shell memory={memory}/>
  </SafeAreaProvider></GestureRoot>;
}

/** Native scroll views must keep their viewport while another screen covers them. */
function ScreenLayer({hidden = false, prepared = false, children, backTransition, alternateTransition, useAlternate = false, testID}: {
  hidden?: boolean; prepared?: boolean; children: ReactNode; backTransition?: BackTransition; testID: string;
  alternateTransition?: BackTransition; useAlternate?: boolean;
}) {
  const source: BackUnderlaySource = hidden ? (useAlternate ? 1 : 0) : null;
  // Route/visibility changes only update weights, never replace the attached graph.
  const underlay = useMemo(() => createBackUnderlay(backTransition, alternateTransition, source), [backTransition, alternateTransition]);
  useLayoutEffect(() => {underlay.select(source);}, [underlay, source]);
  return <Animated.View testID={testID} collapsable={false} aria-hidden={hidden} accessibilityElementsHidden={hidden}
    {...(Platform.OS === 'web' ? {inert: hidden} : {})}
    importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'} pointerEvents={hidden ? 'none' : 'auto'}
    style={[StyleSheet.absoluteFillObject, {opacity: hidden && !prepared ? 0 : 1,
      zIndex: hidden ? 0 : 1, transform: [{translateX: underlay.translateX}]},
      Platform.OS === 'web' && hidden && !prepared && {display: 'none'}]}>
    {children}
    <Animated.View testID={`${testID}-dim`} pointerEvents="none" accessible={false}
      style={[StyleSheet.absoluteFillObject, {backgroundColor: '#000', opacity: underlay.dimOpacity}]}/>
  </Animated.View>;
}

function Shell({memory}: {memory: ScreenMemory}) {
  const {data, view, saveError} = useSyncExternalStore(memory.subscribe, memory.getSnapshot);
  useScreenMemory(memory);
  const {tab, searches, libraryFilter, creationFilter, openedCardId, detailCardId} = view;
  const {cards, chats} = data;
  const openedCard = cards.find(card => card.id === openedCardId);
  const detailCard = useMemo(() => publishedLibraryCards(cards).find(card => card.id === detailCardId), [cards, detailCardId]);
  const nextCardNumber = useRef(0);
  const safe = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const contentWidth = width - safe.left - safe.right;
  const corners = useScreenCorners();
  const detailBackX = useRef(new Animated.Value(0)).current;
  const editorBackX = useRef(new Animated.Value(0)).current;
  const detailBack = useMemo(() => createBackTransition(detailBackX, width, corners), [detailBackX, width, corners]);
  const editorBack = useMemo(() => createBackTransition(editorBackX, width, corners), [editorBackX, width, corners]);
  const scale = navigationScale(contentWidth);
  const search = useCallback((scope: 'library' | 'chats' | 'create', change: Partial<{open: boolean; query: string}>) => {
    memory.updateView(current => ({...current, searches: {...current.searches, [scope]: {...current.searches[scope], ...change}}}));
  }, [memory]);
  const closeSearch = useCallback(() => {Keyboard.dismiss(); search('library', {open: false, query: ''});}, [search]);
  const closeChatSearch = useCallback(() => {Keyboard.dismiss(); search('chats', {open: false, query: ''});}, [search]);
  const closeCreationSearch = useCallback(() => {Keyboard.dismiss(); search('create', {open: false, query: ''});}, [search]);
  const setQuery = useCallback((query: string) => search('library', {query}), [search]);
  const setChatQuery = useCallback((query: string) => search('chats', {query}), [search]);
  const setCreationQuery = useCallback((query: string) => search('create', {query}), [search]);
  const setLibraryFilter = useCallback((filter: LibraryFilter) => memory.updateView(current => ({...current, libraryFilter: filter})), [memory]);
  const setCreationFilter = useCallback((filter: CreationFilter) => memory.updateView(current => ({...current, creationFilter: filter})), [memory]);
  const closeEditor = useCallback(() => {
    editorBack.finish(); Keyboard.dismiss();
    memory.updateView(current => ({...current, openedCardId: null}));
  }, [editorBack, memory]);
  const closeDetail = useCallback(() => {
    detailBack.finish(); memory.updateView(current => ({...current, detailCardId: null}));
  }, [detailBack, memory]);
  const openDetail = useCallback((id: string) => {
    detailBack.prepareOpen();
    Keyboard.dismiss(); memory.resetScroll('detail');
    memory.updateView(current => ({...current, detailCardId: id}));
  }, [detailBack, memory]);
  const openCard = useCallback((id: string) => {
    editorBack.prepareOpen();
    Keyboard.dismiss(); memory.resetScroll('editor');
    memory.updateView(current => ({...current, openedCardId: id}));
  }, [editorBack, memory]);
  const createCard = useCallback(() => {
    const id = `created-${Date.now()}-${++nextCardNumber.current}`;
    memory.dispatchCard({type: 'create', id, now: Date.now()}); openCard(id);
  }, [memory, openCard]);
  function changeTab(next: Tab) {
    // onPress remains as a keyboard/accessibility fallback after onPressIn.
    memory.updateView(current => current.tab === next ? current : {...current, tab: next});
    if (next !== tab) Keyboard.dismiss();
  }
  const stepPage = useCallback((direction: SwipeDirection) => memory.updateView(current => stepRootView(current, direction)), [memory]);
  // Stable elements let React skip the lists entirely during tab-only updates.
  const libraryPages = useMemo(() => Object.fromEntries(libraryFilters.map(({id}) => [`library:${id}`, <Library key={id}
      items={publishedLibraryCards(cards)} width={contentWidth} scale={scale} memory={memory}
      filter={id} selected={libraryFilter === id} onFilterChange={setLibraryFilter} onOpen={openDetail}
      header={<Header tab="library" scale={scale} onSearch={() => searches.library.open ? closeSearch() : search('library', {open: true})} searchOpen={searches.library.open}/>}
      searchOpen={searches.library.open} query={searches.library.query} onQueryChange={setQuery} onCloseSearch={closeSearch}/>])),
    [cards, contentWidth, scale, memory, libraryFilter, setLibraryFilter, searches.library, search, setQuery, closeSearch, openDetail]);
  const chatsPage = useMemo(() => <Chats items={chats} width={contentWidth} scale={scale} memory={memory}
      header={<Header tab="chats" scale={scale} onSearch={() => searches.chats.open ? closeChatSearch() : search('chats', {open: true})} searchOpen={searches.chats.open}/>}
      searchOpen={searches.chats.open} query={searches.chats.query} onQueryChange={setChatQuery} onCloseSearch={closeChatSearch}/>,
    [chats, contentWidth, scale, memory, searches.chats, search, setChatQuery, closeChatSearch]);
  const creationPages = useMemo(() => Object.fromEntries(creationFilters.map(({id}) => [`create:${id}`, <Creation key={id}
      cards={cards} width={contentWidth} scale={scale} memory={memory}
      filter={id} selected={creationFilter === id} onFilterChange={setCreationFilter}
      header={<Header tab="create" scale={scale} onSearch={() => searches.create.open ? closeCreationSearch() : search('create', {open: true})} searchOpen={searches.create.open} onAction={createCard}/>}
      searchOpen={searches.create.open} query={searches.create.query} onQueryChange={setCreationQuery} onCloseSearch={closeCreationSearch} onOpen={openCard}/>])),
    [cards, contentWidth, scale, memory, creationFilter, setCreationFilter, searches.create, search, setCreationQuery, closeCreationSearch, createCard, openCard]);
  const settingsPage = useMemo(() => <><Header tab="settings" scale={scale} onSearch={() => {}} searchOpen={false}/>
    <SwipeSurface testID="ui-settings-swipe"><Settings scale={scale} memory={memory}/></SwipeSurface></>, [scale, memory]);
  return <View testID="ui-shell" style={{flex: 1, backgroundColor: colors.background}}>
    <View style={{flex: 1, minHeight: 0, overflow: 'hidden'}}>
      <ScreenLayer testID="ui-root-screen" hidden={!!openedCard || !!detailCard} prepared={!openedCard || !detailCard}
        backTransition={detailBack} alternateTransition={editorBack} useAlternate={!detailCard}>
        <View testID="ui-root-safe-content" style={{flex: 1, minHeight: 0, backgroundColor: colors.background,
          paddingTop: safe.top, paddingLeft: safe.left, paddingRight: safe.right}}>
        <TabPages view={view} width={contentWidth} enabled={!openedCard && !detailCard} onStep={stepPage}
          pages={{...libraryPages, ...creationPages, chats: chatsPage, settings: settingsPage} as Record<RootPageKey, ReactNode>}/>
        <TabBar tab={tab} onChange={changeTab} scale={scale} bottomInset={safe.bottom}/>
        </View>
      </ScreenLayer>
      {detailCard && <ScreenLayer testID="ui-detail-screen" hidden={!!openedCard} prepared backTransition={editorBack}>
        <CardDetail key={detailCard.id} card={detailCard} width={contentWidth} scale={scale} bottomInset={safe.bottom}
          active={!openedCard} memory={memory} onClose={closeDetail} onEdit={() => openCard(detailCard.id)} backTransition={detailBack}/>
      </ScreenLayer>}
      {openedCard && <ScreenLayer testID="ui-editor-screen">
        <CardEditor card={openedCard} scale={scale} memory={memory} topInset={safe.top} bottomInset={safe.bottom} onClose={closeEditor} backTransition={editorBack}
          onChange={(field, value) => memory.dispatchCard({type: 'edit', id: openedCard.id, field, value, now: Date.now()})}
          onComplete={() => {memory.dispatchCard({type: 'complete', id: openedCard.id, now: Date.now()}); closeEditor();}}/>
      </ScreenLayer>}
    </View>
    {saveError && <Pressable accessibilityRole="button" accessibilityLabel="화면 저장 다시 시도" onPress={() => {void memory.flush();}}
      style={{padding: 12, backgroundColor: colors.surface}}>
      <Text accessibilityRole="alert" style={{color: colors.error}}>변경 내용을 저장하지 못했어요. 눌러서 다시 시도</Text>
    </Pressable>}
  </View>;
}
