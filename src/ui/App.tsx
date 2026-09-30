import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {Keyboard, NativeModules, Platform, Pressable, StatusBar, Text, View, useWindowDimensions} from 'react-native';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Header, TabBar, type Tab} from './Navigation';
import {TabPages} from './TabPages';
import {Library} from './Library';
import {Chats} from './Chats';
import {Creation} from './Creation';
import {Settings} from './Settings';
import {CardEditor} from './CardEditor';
import {publishedLibraryCards} from './cardWorkspace';
import {ScreenMemory} from './ScreenMemory';
import {createScreenStorage} from './screenStorage';
import {useScreenMemory} from './useScreenMemory';
import type {LibraryFilter} from './screenState';
import type {CreationFilter} from './creationPreview';
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
  return <SafeAreaProvider style={{flex: 1, backgroundColor: colors.background}}>
    <StatusBar barStyle={uiAppearance === 'light' ? 'dark-content' : 'light-content'}/>
    <Shell memory={memory}/>
  </SafeAreaProvider>;
}

function Shell({memory}: {memory: ScreenMemory}) {
  const {data, view, saveError} = useSyncExternalStore(memory.subscribe, memory.getSnapshot);
  useScreenMemory(memory);
  const {tab, searches, libraryFilter, creationFilter, openedCardId} = view;
  const {cards, chats} = data;
  const openedCard = cards.find(card => card.id === openedCardId);
  const nextCardNumber = useRef(0);
  const safe = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const contentWidth = width - safe.left - safe.right;
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
  const closeEditor = useCallback(() => {Keyboard.dismiss(); memory.updateView(current => ({...current, openedCardId: null}));}, [memory]);
  const openCard = useCallback((id: string) => {
    Keyboard.dismiss(); memory.resetScroll('editor');
    memory.updateView(current => ({...current, openedCardId: id}));
  }, [memory]);
  const createCard = useCallback(() => {
    const id = `created-${Date.now()}-${++nextCardNumber.current}`;
    memory.dispatchCard({type: 'create', id, now: Date.now()}); openCard(id);
  }, [memory, openCard]);
  function changeTab(next: Tab) {
    // onPress remains as a keyboard/accessibility fallback after onPressIn.
    memory.updateView(current => current.tab === next ? current : {...current, tab: next});
    if (next !== tab) Keyboard.dismiss();
  }
  // Stable elements let React skip the lists entirely during tab-only updates.
  const libraryPage = useMemo(() => <Library items={publishedLibraryCards(cards)} width={contentWidth} scale={scale} memory={memory}
      filter={libraryFilter} onFilterChange={setLibraryFilter}
      header={<Header tab="library" scale={scale} onSearch={() => searches.library.open ? closeSearch() : search('library', {open: true})} searchOpen={searches.library.open}/>}
      searchOpen={searches.library.open} query={searches.library.query} onQueryChange={setQuery} onCloseSearch={closeSearch}/>,
    [cards, contentWidth, scale, memory, libraryFilter, setLibraryFilter, searches.library, search, setQuery, closeSearch]);
  const chatsPage = useMemo(() => <Chats items={chats} width={contentWidth} scale={scale} memory={memory}
      header={<Header tab="chats" scale={scale} onSearch={() => searches.chats.open ? closeChatSearch() : search('chats', {open: true})} searchOpen={searches.chats.open}/>}
      searchOpen={searches.chats.open} query={searches.chats.query} onQueryChange={setChatQuery} onCloseSearch={closeChatSearch}/>,
    [chats, contentWidth, scale, memory, searches.chats, search, setChatQuery, closeChatSearch]);
  const creationPage = useMemo(() => <Creation cards={cards} width={contentWidth} scale={scale} memory={memory}
      filter={creationFilter} onFilterChange={setCreationFilter}
      header={<Header tab="create" scale={scale} onSearch={() => searches.create.open ? closeCreationSearch() : search('create', {open: true})} searchOpen={searches.create.open} onAction={createCard}/>}
      searchOpen={searches.create.open} query={searches.create.query} onQueryChange={setCreationQuery} onCloseSearch={closeCreationSearch} onOpen={openCard}/>,
    [cards, contentWidth, scale, memory, creationFilter, setCreationFilter, searches.create, search, setCreationQuery, closeCreationSearch, createCard, openCard]);
  const settingsPage = useMemo(() => <><Header tab="settings" scale={scale} onSearch={() => {}} searchOpen={false}/><Settings scale={scale} memory={memory}/></>, [scale, memory]);
  return <View testID="ui-shell" style={{flex: 1, backgroundColor: colors.background, paddingTop: safe.top, paddingLeft: safe.left, paddingRight: safe.right}}>
    <View aria-hidden={!!openedCard} accessibilityElementsHidden={!!openedCard} importantForAccessibility={openedCard ? 'no-hide-descendants' : 'auto'}
      style={{flex: 1, minHeight: 0, display: openedCard ? 'none' : 'flex'}}>
      <TabPages tab={tab} pages={{library: libraryPage, chats: chatsPage, create: creationPage, settings: settingsPage}}/>
      <TabBar tab={tab} onChange={changeTab} scale={scale} bottomInset={safe.bottom}/>
    </View>
    {openedCard && <CardEditor card={openedCard} scale={scale} memory={memory} topInset={safe.top} bottomInset={safe.bottom} onClose={closeEditor}
      onChange={(field, value) => memory.dispatchCard({type: 'edit', id: openedCard.id, field, value, now: Date.now()})}
      onComplete={() => {memory.dispatchCard({type: 'complete', id: openedCard.id, now: Date.now()}); closeEditor();}}/>}
    {saveError && <Pressable accessibilityRole="button" accessibilityLabel="화면 저장 다시 시도" onPress={() => {void memory.flush();}}
      style={{padding: 12, backgroundColor: colors.surface}}>
      <Text accessibilityRole="alert" style={{color: colors.error}}>변경 내용을 저장하지 못했어요. 눌러서 다시 시도</Text>
    </Pressable>}
  </View>;
}
