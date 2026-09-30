import {useCallback, useEffect, useMemo, useReducer, useRef, useState} from 'react';
import {Keyboard, NativeModules, Platform, StatusBar, View, useWindowDimensions} from 'react-native';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Header, TabBar, type Tab} from './Navigation';
import {TabPages} from './TabPages';
import {Library} from './Library';
import {Chats} from './Chats';
import {Creation} from './Creation';
import {Settings} from './Settings';
import {CardEditor} from './CardEditor';
import {cardWorkspaceReducer, createPreviewWorkspace, publishedLibraryCards} from './cardWorkspace';
import {colors, navigationScale, uiAppearance} from './tokens';

/** Fresh UI with isolated preview state; no legacy services or persistence. */
export default function App() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    NativeModules.PromliveSystemBars?.setDarkIcons(uiAppearance === 'light');
    const frame = requestAnimationFrame(() => NativeModules.PromliveStartup?.ready(uiAppearance));
    return () => cancelAnimationFrame(frame);
  }, []);
  return <SafeAreaProvider style={{flex: 1, backgroundColor: colors.background}}>
    <StatusBar barStyle={uiAppearance === 'light' ? 'dark-content' : 'light-content'}/>
    <Shell/>
  </SafeAreaProvider>;
}

function Shell() {
  const [tab, setTab] = useState<Tab>('library');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatQuery, setChatQuery] = useState('');
  const [creationSearchOpen, setCreationSearchOpen] = useState(false);
  const [creationQuery, setCreationQuery] = useState('');
  const [cards, dispatchCard] = useReducer(cardWorkspaceReducer, undefined, createPreviewWorkspace);
  const [openedCardId, setOpenedCardId] = useState<string | null>(null);
  const openedCard = cards.find(card => card.id === openedCardId);
  const nextCardNumber = useRef(0);
  const safe = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const contentWidth = width - safe.left - safe.right;
  const scale = navigationScale(contentWidth);
  const closeSearch = useCallback(() => {
    Keyboard.dismiss();
    setSearchOpen(false);
    setQuery('');
  }, []);
  const closeChatSearch = useCallback(() => {
    Keyboard.dismiss();
    setChatSearchOpen(false);
    setChatQuery('');
  }, []);
  const closeCreationSearch = useCallback(() => {
    Keyboard.dismiss();
    setCreationSearchOpen(false);
    setCreationQuery('');
  }, []);
  function closeEditor() {
    Keyboard.dismiss();
    setOpenedCardId(null);
  }
  const createCard = useCallback(() => {
    const id = `created-${Date.now()}-${++nextCardNumber.current}`;
    dispatchCard({type: 'create', id, now: Date.now()});
    Keyboard.dismiss();
    setOpenedCardId(id);
  }, []);
  const openCard = useCallback((id: string) => {
    Keyboard.dismiss();
    setOpenedCardId(id);
  }, []);
  function changeTab(next: Tab) {
    // onPress remains as a keyboard/accessibility fallback after onPressIn.
    if (next === tab) return;
    setTab(next);
    Keyboard.dismiss();
  }
  // Stable elements let React skip the lists entirely during tab-only updates.
  const libraryPage = useMemo(() => <Library items={publishedLibraryCards(cards)} width={contentWidth} scale={scale}
      header={<Header tab="library" scale={scale} onSearch={() => searchOpen ? closeSearch() : setSearchOpen(true)} searchOpen={searchOpen}/>}
      searchOpen={searchOpen} query={query} onQueryChange={setQuery} onCloseSearch={closeSearch}/>,
    [cards, contentWidth, scale, searchOpen, query, closeSearch]);
  const chatsPage = useMemo(() => <Chats width={contentWidth} scale={scale}
      header={<Header tab="chats" scale={scale} onSearch={() => chatSearchOpen ? closeChatSearch() : setChatSearchOpen(true)} searchOpen={chatSearchOpen}/>}
      searchOpen={chatSearchOpen} query={chatQuery} onQueryChange={setChatQuery} onCloseSearch={closeChatSearch}/>,
    [contentWidth, scale, chatSearchOpen, chatQuery, closeChatSearch]);
  const creationPage = useMemo(() => <Creation cards={cards} width={contentWidth} scale={scale}
      header={<Header tab="create" scale={scale} onSearch={() => creationSearchOpen ? closeCreationSearch() : setCreationSearchOpen(true)} searchOpen={creationSearchOpen} onAction={createCard}/>}
      searchOpen={creationSearchOpen} query={creationQuery} onQueryChange={setCreationQuery} onCloseSearch={closeCreationSearch} onOpen={openCard}/>,
    [cards, contentWidth, scale, creationSearchOpen, creationQuery, closeCreationSearch, createCard, openCard]);
  const settingsPage = useMemo(() => <><Header tab="settings" scale={scale} onSearch={() => {}} searchOpen={false}/><Settings scale={scale}/></>, [scale]);
  return <View testID="ui-shell" style={{flex: 1, backgroundColor: colors.background, paddingTop: safe.top, paddingLeft: safe.left, paddingRight: safe.right}}>
    <View aria-hidden={!!openedCard} accessibilityElementsHidden={!!openedCard} importantForAccessibility={openedCard ? 'no-hide-descendants' : 'auto'}
      style={{flex: 1, minHeight: 0, display: openedCard ? 'none' : 'flex'}}>
      <TabPages tab={tab} pages={{library: libraryPage, chats: chatsPage, create: creationPage, settings: settingsPage}}/>
      <TabBar tab={tab} onChange={changeTab} scale={scale} bottomInset={safe.bottom}/>
    </View>
    {openedCard && <CardEditor card={openedCard} scale={scale} topInset={safe.top} bottomInset={safe.bottom} onClose={closeEditor}
      onChange={(field, value) => dispatchCard({type: 'edit', id: openedCard.id, field, value, now: Date.now()})}
      onComplete={() => {dispatchCard({type: 'complete', id: openedCard.id, now: Date.now()}); closeEditor();}}/>}
  </View>;
}
