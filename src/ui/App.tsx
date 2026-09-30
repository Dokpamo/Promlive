import {useEffect, useReducer, useRef, useState} from 'react';
import {Keyboard, NativeModules, Platform, StatusBar, View, useWindowDimensions} from 'react-native';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Header, TabBar, type Tab} from './Navigation';
import {Library} from './Library';
import {Chats} from './Chats';
import {Creation} from './Creation';
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
  const scale = navigationScale(width - safe.left - safe.right);
  function closeSearch() {
    Keyboard.dismiss();
    setSearchOpen(false);
    setQuery('');
  }
  function closeChatSearch() {
    Keyboard.dismiss();
    setChatSearchOpen(false);
    setChatQuery('');
  }
  function closeCreationSearch() {
    Keyboard.dismiss();
    setCreationSearchOpen(false);
    setCreationQuery('');
  }
  function closeEditor() {
    Keyboard.dismiss();
    setOpenedCardId(null);
  }
  function createCard() {
    const id = `created-${Date.now()}-${++nextCardNumber.current}`;
    dispatchCard({type: 'create', id, now: Date.now()});
    Keyboard.dismiss();
    setOpenedCardId(id);
  }
  return <View testID="ui-shell" style={{flex: 1, backgroundColor: colors.background, paddingTop: safe.top, paddingLeft: safe.left, paddingRight: safe.right}}>
    <View style={{flex: 1, minHeight: 0, display: openedCard ? 'none' : 'flex'}}>
    {tab === 'settings' && <Header tab={tab} scale={scale} onSearch={() => {}} searchOpen={false}/>}
    <View key={tab} testID={`ui-page-${tab}`} style={{flex: 1, minHeight: 0, overflow: 'hidden'}}>
      {tab === 'library' && <Library items={publishedLibraryCards(cards)} width={width - safe.left - safe.right} scale={scale}
        header={<Header tab={tab} scale={scale} onSearch={() => searchOpen ? closeSearch() : setSearchOpen(true)} searchOpen={searchOpen}/>}
        searchOpen={searchOpen} query={query} onQueryChange={setQuery} onCloseSearch={closeSearch}/>}
      {tab === 'chats' && <Chats width={width - safe.left - safe.right} scale={scale}
        header={<Header tab={tab} scale={scale} onSearch={() => chatSearchOpen ? closeChatSearch() : setChatSearchOpen(true)} searchOpen={chatSearchOpen}/>}
        searchOpen={chatSearchOpen} query={chatQuery} onQueryChange={setChatQuery} onCloseSearch={closeChatSearch}/>}
      {tab === 'create' && <Creation cards={cards} width={width - safe.left - safe.right} scale={scale}
        header={<Header tab={tab} scale={scale} onSearch={() => creationSearchOpen ? closeCreationSearch() : setCreationSearchOpen(true)} searchOpen={creationSearchOpen} onAction={createCard}/>}
        searchOpen={creationSearchOpen} query={creationQuery} onQueryChange={setCreationQuery} onCloseSearch={closeCreationSearch}
        onOpen={id => {Keyboard.dismiss(); setOpenedCardId(id);}}/>}
    </View>
    <TabBar tab={tab} onChange={next => {Keyboard.dismiss(); setTab(next);}} scale={scale} bottomInset={safe.bottom}/>
    </View>
    {openedCard && <CardEditor card={openedCard} scale={scale} topInset={safe.top} bottomInset={safe.bottom} onClose={closeEditor}
      onChange={(field, value) => dispatchCard({type: 'edit', id: openedCard.id, field, value, now: Date.now()})}
      onComplete={() => {dispatchCard({type: 'complete', id: openedCard.id, now: Date.now()}); closeEditor();}}/>}
  </View>;
}
