import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode} from 'react';
import {Animated, Keyboard, NativeModules, Platform, Pressable, StatusBar, Text, View, useWindowDimensions} from 'react-native';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Header, TabBar, type Tab} from './Navigation';
import {TabPages, type RootPageHandle} from './TabPages';
import {Library} from './Library';
import {Chats} from './Chats';
import {Creation} from './Creation';
import {Settings} from './Settings';
import {CardEditor} from './CardEditor';
import {CardDetail} from './CardDetail';
import {ImageViewer} from './ImageViewer';
import {ChatRoom} from './ChatRoom';
import {GestureRoot} from './GestureRoot';
import {SwipeSurface} from './SwipeSurface';
import {createBackTransition} from './backTransition';
import {useScreenCorners} from './useScreenCorners';
import {libraryFilters, stepRootView, type RootPageKey, type SwipeDirection} from './swipeNavigation';
import {publishedLibraryCards} from './cardWorkspace';
import {ScreenMemory} from './ScreenMemory';
import {createScreenStorage} from './screenStorage';
import {useScreenMemory} from './useScreenMemory';
import type {LibraryFilter, ScreenView} from './screenState';
import {creationFilters, type CreationFilter} from './creationPreview';
import {navigationScale} from './tokens';
import {TabBarContentInset, tabBarLayout} from './tabBarLayout';
import {ThemeProvider, useTheme} from './Theme';
import {ScreenLayer} from './ScreenLayer';
import {SettingsServicesProvider, type SettingsServices} from './settings/SettingsServices';
import {SettingsNavigator} from './settings/SettingsNavigator';
import type {SettingsDestination} from './settings/OtherSettings';
import {DesktopShell} from './desktop/DesktopShell';
import {isDesktopLayout} from './desktop/desktopLayout';

/** First render uses the local snapshot; background refresh never replaces it with a loader. */
export default function App({memory: provided, settingsServices}: {memory?: ScreenMemory; settingsServices?: SettingsServices} = {}) {
  const [memory] = useState(() => provided ?? new ScreenMemory(createScreenStorage()));
  return <SettingsServicesProvider services={settingsServices}><ThemeProvider memory={memory}><AppFrame memory={memory}/></ThemeProvider></SettingsServicesProvider>;
}
function AppFrame({memory}: {memory: ScreenMemory}) {
  const {width} = useWindowDimensions();
  const {colors, appearance: uiAppearance} = useTheme();
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const frame = requestAnimationFrame(() => NativeModules.PromliveStartup?.ready(uiAppearance));
    return () => cancelAnimationFrame(frame);
  }, [uiAppearance]);
  return <GestureRoot style={{flex: 1}}><SafeAreaProvider style={{flex: 1, backgroundColor: colors.background}}>
    <StatusBar barStyle={uiAppearance === 'light' ? 'dark-content' : 'light-content'}/>
    {isDesktopLayout(Platform.OS, width) ? <DesktopShell memory={memory}/> : <Shell memory={memory}/>}
  </SafeAreaProvider></GestureRoot>;
}

function Shell({memory}: {memory: ScreenMemory}) {
  const {colors, appearance: uiAppearance} = useTheme();
  const [settingsDetail, setSettingsDetail] = useState<SettingsDestination | null>(null);
  const {data, view, saveError, storageIssue} = useSyncExternalStore(memory.subscribe, memory.getSnapshot);
  useScreenMemory(memory);
  const {tab, searches, libraryFilter, creationFilter, openedCardId, detailCardId, coverOpen, galleryIndex, chatId} = view;
  const {cards, chats} = data;
  const openedCard = cards.find(card => card.id === openedCardId);
  const openedChat = chats.find(chat => chat.id === chatId);
  const detailCard = useMemo(() => publishedLibraryCards(cards).find(card => card.id === detailCardId), [cards, detailCardId]);
  const viewingCover = coverOpen && !!detailCard && !openedCard && !openedChat;
  useEffect(() => {
    if (Platform.OS === 'android') NativeModules.PromliveSystemBars?.setDarkIcons(!viewingCover && uiAppearance === 'light');
  }, [viewingCover, uiAppearance]);
  const nextCardNumber = useRef(0);
  const rootPagesRef = useRef<RootPageHandle>(null);
  const navigateRoot = useCallback((update: (current: ScreenView) => ScreenView, animateTab = false) => {
    memory.updateView(current => {
      const next = update(current);
      if (next !== current) rootPagesRef.current?.prepare(next, animateTab);
      return next;
    });
  }, [memory]);
  const safe = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const contentWidth = width - safe.left - safe.right;
  const corners = useScreenCorners();
  const detailBackX = useRef(new Animated.Value(0)).current;
  const editorBackX = useRef(new Animated.Value(0)).current;
  const imageBackX = useRef(new Animated.Value(0)).current;
  const detailBack = useMemo(() => createBackTransition(detailBackX, width, corners), [detailBackX, width, corners]);
  const editorBack = useMemo(() => createBackTransition(editorBackX, width, corners), [editorBackX, width, corners]);
  const imageBack = useMemo(() => createBackTransition(imageBackX, width, corners), [imageBackX, width, corners]);
  const scale = navigationScale(contentWidth);
  const tabLayout = tabBarLayout(Platform.OS, contentWidth, scale, safe.bottom);
  const openSettings = useCallback((page: SettingsDestination) => {editorBack.prepareOpen(); Keyboard.dismiss(); setSettingsDetail(page);}, [editorBack]);
  const closeSettings = useCallback(() => {editorBack.finish(); Keyboard.dismiss(); setSettingsDetail(null);}, [editorBack]);
  const search = useCallback((scope: 'library' | 'chats' | 'create', change: Partial<{open: boolean; query: string}>) => {
    memory.updateView(current => ({...current, searches: {...current.searches, [scope]: {...current.searches[scope], ...change}}}));
  }, [memory]);
  const closeSearch = useCallback(() => {Keyboard.dismiss(); search('library', {open: false, query: ''});}, [search]);
  const closeChatSearch = useCallback(() => {Keyboard.dismiss(); search('chats', {open: false, query: ''});}, [search]);
  const closeCreationSearch = useCallback(() => {Keyboard.dismiss(); search('create', {open: false, query: ''});}, [search]);
  const setQuery = useCallback((query: string) => search('library', {query}), [search]);
  const setChatQuery = useCallback((query: string) => search('chats', {query}), [search]);
  const setCreationQuery = useCallback((query: string) => search('create', {query}), [search]);
  const setLibraryFilter = useCallback((filter: LibraryFilter) => navigateRoot(current => current.libraryFilter === filter ? current : {...current, libraryFilter: filter}), [navigateRoot]);
  const setCreationFilter = useCallback((filter: CreationFilter) => navigateRoot(current => current.creationFilter === filter ? current : {...current, creationFilter: filter}), [navigateRoot]);
  const closeEditor = useCallback(() => {
    editorBack.finish(); Keyboard.dismiss();
    memory.updateView(current => ({...current, openedCardId: null}));
  }, [editorBack, memory]);
  const closeDetail = useCallback(() => {
    detailBack.finish(); memory.updateView(current => ({...current, detailCardId: null, coverOpen: false}));
  }, [detailBack, memory]);
  const openDetail = useCallback((id: string) => {
    detailBack.prepareOpen();
    Keyboard.dismiss(); memory.resetScroll('detail');
    memory.updateView(current => ({...current, detailCardId: id, coverOpen: false, galleryIndex: null, chatId: null}));
  }, [detailBack, memory]);
  const openCard = useCallback((id: string) => {
    editorBack.prepareOpen();
    Keyboard.dismiss(); memory.resetScroll('editor');
    memory.updateView(current => ({...current, openedCardId: id, coverOpen: false, chatId: null}));
  }, [editorBack, memory]);
  const openImage = useCallback((index?: number) => {
    imageBack.prepareOpen(); Keyboard.dismiss();
    memory.updateView(current => ({...current, coverOpen: true, galleryIndex: index ?? null}));
  }, [imageBack, memory]);
  const closeImage = useCallback(() => {
    imageBack.finish(); memory.updateView(current => ({...current, coverOpen: false, galleryIndex: null}));
  }, [imageBack, memory]);
  const openChat = useCallback((id: string) => {
    editorBack.prepareOpen(); Keyboard.dismiss();
    memory.updateView(current => ({...current, chatId: id, openedCardId: null, coverOpen: false, galleryIndex: null}));
  }, [editorBack, memory]);
  const closeChat = useCallback(() => {
    editorBack.finish(); Keyboard.dismiss();
    memory.updateView(current => ({...current, chatId: null}));
  }, [editorBack, memory]);
  const createCard = useCallback(() => {
    const id = `created-${Date.now()}-${++nextCardNumber.current}`;
    memory.dispatchCard({type: 'create', id, now: Date.now()}); openCard(id);
  }, [memory, openCard]);
  function changeTab(next: Tab) {
    // onPress remains as a keyboard/accessibility fallback after onPressIn.
    navigateRoot(current => current.tab === next ? current : {...current, tab: next}, true);
    if (next !== tab) Keyboard.dismiss();
  }
  const stepPage = useCallback((direction: SwipeDirection) => navigateRoot(current => stepRootView(current, direction)), [navigateRoot]);
  // Stable elements let React skip the lists entirely during tab-only updates.
  const libraryPages = useMemo(() => Object.fromEntries(libraryFilters.map(({id}) => [`library:${id}`, <Library key={id}
      items={publishedLibraryCards(cards)} width={contentWidth} scale={scale} memory={memory}
      filter={id} selected={libraryFilter === id} onFilterChange={setLibraryFilter} onOpen={openDetail}
      header={<Header tab="library" scale={scale} onSearch={() => searches.library.open ? closeSearch() : search('library', {open: true})} searchOpen={searches.library.open}/>}
      searchOpen={searches.library.open} query={searches.library.query} onQueryChange={setQuery} onCloseSearch={closeSearch}/>])),
    [cards, contentWidth, scale, memory, libraryFilter, setLibraryFilter, searches.library, search, setQuery, closeSearch, openDetail]);
  const chatsPage = useMemo(() => <Chats items={chats} width={contentWidth} scale={scale} memory={memory}
      header={<Header tab="chats" scale={scale} onSearch={() => searches.chats.open ? closeChatSearch() : search('chats', {open: true})} searchOpen={searches.chats.open}/>}
      searchOpen={searches.chats.open} query={searches.chats.query} onQueryChange={setChatQuery} onCloseSearch={closeChatSearch} onOpen={openChat}/>,
    [chats, contentWidth, scale, memory, searches.chats, search, setChatQuery, closeChatSearch, openChat]);
  const creationPages = useMemo(() => Object.fromEntries(creationFilters.map(({id}) => [`create:${id}`, <Creation key={id}
      cards={cards} width={contentWidth} scale={scale} memory={memory}
      filter={id} selected={creationFilter === id} onFilterChange={setCreationFilter}
      header={<Header tab="create" scale={scale} onSearch={() => searches.create.open ? closeCreationSearch() : search('create', {open: true})} searchOpen={searches.create.open} onAction={createCard}/>}
      searchOpen={searches.create.open} query={searches.create.query} onQueryChange={setCreationQuery} onCloseSearch={closeCreationSearch} onOpen={openCard}/>])),
    [cards, contentWidth, scale, memory, creationFilter, setCreationFilter, searches.create, search, setCreationQuery, closeCreationSearch, createCard, openCard]);
  const settingsPage = useMemo(() => <><Header tab="settings" scale={scale} onSearch={() => {}} searchOpen={false} onAction={() => openSettings('profile')}/>
    <SwipeSurface testID="ui-settings-swipe"><Settings scale={scale} memory={memory} onOpen={openSettings}/></SwipeSurface></>, [scale, memory, openSettings]);
  return <View testID="ui-shell" style={{flex: 1, backgroundColor: colors.background}}>
    <View style={{flex: 1, minHeight: 0, overflow: 'hidden'}}>
      <ScreenLayer testID="ui-root-screen" hidden={!!openedCard || !!detailCard || !!openedChat || !!settingsDetail} prepared={!viewingCover && (!(openedCard || openedChat) || !detailCard)}
        backTransition={detailBack} alternateTransition={editorBack} useAlternate={!detailCard}>
        <View testID="ui-root-safe-content" style={{flex: 1, minHeight: 0, backgroundColor: colors.background,
          paddingTop: safe.top, paddingLeft: safe.left, paddingRight: safe.right}}>
        <TabBarContentInset.Provider value={tabLayout.contentInset}>
        <TabPages ref={rootPagesRef} view={view} width={contentWidth} enabled={!openedCard && !detailCard && !openedChat && !settingsDetail} onStep={stepPage}
          pages={{...libraryPages, ...creationPages, chats: chatsPage, settings: settingsPage} as Record<RootPageKey, ReactNode>}/>
        </TabBarContentInset.Provider>
        <TabBar tab={tab} onChange={changeTab} scale={scale} layout={tabLayout}/>
        </View>
      </ScreenLayer>
      {detailCard && <ScreenLayer testID="ui-detail-screen" hidden={!!openedCard || !!openedChat || viewingCover} prepared backTransition={editorBack} alternateTransition={imageBack} useAlternate={viewingCover}>
        <CardDetail key={detailCard.id} card={detailCard} width={contentWidth} scale={scale} bottomInset={safe.bottom}
          active={!openedCard && !openedChat && !viewingCover} memory={memory} onClose={closeDetail} onEdit={() => openCard(detailCard.id)} onViewImage={openImage}
          onStartChat={() => {memory.ensureChat(detailCard); openChat(detailCard.id);}} backTransition={detailBack}/>
      </ScreenLayer>}
      {settingsDetail && <ScreenLayer testID="ui-settings-screen"><SettingsNavigator initial={settingsDetail} transition={editorBack} scale={scale} bottomInset={safe.bottom} onClose={closeSettings}/></ScreenLayer>}
      {openedCard && <ScreenLayer testID="ui-editor-screen">
        <CardEditor card={openedCard} scale={scale} memory={memory} topInset={safe.top} bottomInset={safe.bottom} onClose={closeEditor} backTransition={editorBack}
          onChange={(field, value) => memory.dispatchCard({type: 'edit', id: openedCard.id, field, value, now: Date.now()})}
          onGalleryChange={images => memory.dispatchCard({type: 'gallery', id: openedCard.id, images, now: Date.now()})}
          onComplete={() => {memory.dispatchCard({type: 'complete', id: openedCard.id, now: Date.now()}); closeEditor();}}/>
      </ScreenLayer>}
      {viewingCover && detailCard && <ScreenLayer testID="ui-image-screen">
        <ImageViewer card={detailCard} width={contentWidth} scale={scale} onClose={closeImage} transition={imageBack} galleryIndex={galleryIndex}
          onSelectImage={index => memory.updateView(current => ({...current, galleryIndex: index}))}/>
      </ScreenLayer>}
      {openedChat && <ScreenLayer testID="ui-conversation-screen">
        <ChatRoom key={openedChat.id} chat={openedChat} gallery={cards.find(card => card.id === openedChat.id)?.published?.gallery ?? [{id: 'cover', tile: openedChat.tile, title: openedChat.title}]}
          memory={memory} scale={scale} onClose={closeChat} transition={editorBack}/>
      </ScreenLayer>}
    </View>
    {saveError && <Pressable accessibilityRole="button" accessibilityLabel="화면 저장 다시 시도" onPress={() => {void memory.refresh().then(memory.flush);}}
      style={{padding: 12, backgroundColor: colors.surface}}>
      <Text accessibilityRole="alert" style={{color: colors.error}}>{storageIssue === 'corrupt' ? '저장한 데이터를 읽을 수 없어 원본을 보존하고 있어요.'
        : storageIssue === 'unsupported' ? '다른 버전에서 저장한 데이터예요. 원본을 보존하고 있어요.'
          : storageIssue === 'conflict' ? '다른 창의 변경과 충돌해 저장하지 못했어요. 이 창의 수정 내용은 아직 저장되지 않았어요.'
            : storageIssue === 'read' ? '저장한 데이터를 불러오지 못했어요. 눌러서 다시 시도'
              : '변경 내용을 저장하지 못했어요. 눌러서 다시 시도'}</Text>
    </Pressable>}
  </View>;
}
