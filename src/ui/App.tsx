import {useEffect, useState} from 'react';
import {Keyboard, NativeModules, Platform, StatusBar, View, useWindowDimensions} from 'react-native';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Header, TabBar, type Tab} from './Navigation';
import {Library} from './Library';
import {colors, navigationScale} from './tokens';

/** A fresh presentation entry: no workspace, persistence, legacy screens or modals. */
export default function App() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    NativeModules.PromliveSystemBars?.setDarkIcons(true);
    const frame = requestAnimationFrame(() => NativeModules.PromliveStartup?.ready('light'));
    return () => cancelAnimationFrame(frame);
  }, []);
  return <SafeAreaProvider style={{flex: 1, backgroundColor: colors.background}}>
    <StatusBar barStyle="dark-content"/>
    <Shell/>
  </SafeAreaProvider>;
}

function Shell() {
  const [tab, setTab] = useState<Tab>('library');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const safe = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const scale = navigationScale(width - safe.left - safe.right);
  function closeSearch() {
    Keyboard.dismiss();
    setSearchOpen(false);
    setQuery('');
  }
  return <View testID="ui-shell" style={{flex: 1, backgroundColor: colors.background, paddingTop: safe.top, paddingLeft: safe.left, paddingRight: safe.right}}>
    <Header tab={tab} scale={scale} onSearch={() => searchOpen ? closeSearch() : setSearchOpen(true)} searchOpen={searchOpen}/>
    <View key={tab} testID={`ui-page-${tab}`} style={{flex: 1, minHeight: 0}}>
      {tab === 'library' && <Library width={width - safe.left - safe.right} scale={scale}
        searchOpen={searchOpen} query={query} onQueryChange={setQuery} onCloseSearch={closeSearch}/>}
    </View>
    <TabBar tab={tab} onChange={next => {Keyboard.dismiss(); setTab(next);}} scale={scale} bottomInset={safe.bottom}/>
  </View>;
}
