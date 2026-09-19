import {useState} from 'react';
import {FlatList, Keyboard, Pressable, Text, TextInput, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Workspace} from '../../app/workspace';
import type {Card} from '../cards/model';
import {ChatIcon} from './ChatIcon';
import {referenceSidebar as r} from './chatAppearance';
import {useAppearance} from '../appearance/AppAppearance';
import {DrawerGestureBoundary} from './DrawerGestureBoundary';

interface Props {
  workspace: Workspace;
  width: number;
  card?: Card;
  selectedCardId?: string | undefined;
  openCard: (card: Card) => void;
  backToCards: () => void;
  close: () => void;
  openSettings: () => void;
}

/** Cards and their histories share the measured, title-only list layout. */
export function ChatHistory({workspace: w, width, card, selectedCardId, openCard, backToCards, close, openSettings}: Props) {
  const {colors: c, isDark} = useAppearance();
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();
  const {height} = useWindowDimensions();
  const s = width / r.width;
  const query = search.trim().toLocaleLowerCase();
  const cards = w.cards.filter(item => !item.archived && `${item.title} ${item.description}`.toLocaleLowerCase().includes(query));
  const conversations = w.conversations.filter(item => item.cardId === card?.id && `${item.title} ${item.preview ?? ''}`.toLocaleLowerCase().includes(query));
  const items = (card ? conversations : cards).map(item => ({id: item.id, title: item.title}));
  const selectedId = card ? w.conversation?.id : selectedCardId ?? w.conversation?.cardId;
  const shadow = isDark ? undefined : '0px 6px 24px rgba(0, 0, 0, 0.035)';
  const availableHeight = height - insets.top - insets.bottom;
  const listTop = Math.min(r.listTop * s, Math.max(245 * s, availableHeight - 300 * s));
  const select = async (id: string) => {
    Keyboard.dismiss();
    if (!card) {
      const item = cards.find(value => value.id === id);
      if (item) openCard(item);
      return;
    }
    const item = conversations.find(value => value.id === id);
    if (item) {await w.openConversation(item); close();}
  };
  const start = async () => {
    if (!card) return;
    await w.startChat(card, true);
    close();
  };

  return <View testID={card ? 'card-conversations-page' : 'card-list-page'} style={{flex: 1, backgroundColor: c.drawer, paddingTop: insets.top, paddingBottom: insets.bottom}}>
    <View style={{height: listTop}}>
      <View style={{position: 'absolute', left: r.textInset * s, top: r.headerTop * s, right: 28 * s, height: r.headerHeight * s, flexDirection: 'row', alignItems: 'center', gap: 18 * s}}>
        {card && <Pressable accessibilityRole="button" accessibilityLabel="카드 목록으로 돌아가기" onPress={backToCards} hitSlop={10} style={{width: 40 * s, height: 60 * s, justifyContent: 'center'}}><ChatIcon name="back" size={32 * s} color={c.text}/></Pressable>}
        <Text accessibilityRole="header" numberOfLines={1} style={{flex: 1, color: c.text, fontSize: 28 * s, lineHeight: 37 * s, fontWeight: '600', includeFontPadding: false, marginRight: card ? 86 * s : 0}}>{card?.title ?? 'Promlive'}</Text>
      </View>
      {card && <Pressable accessibilityRole="button" accessibilityLabel={`${card.title}에서 새 채팅`} onPress={() => {void start().catch(error => w.report(error));}} style={({pressed}) => ({position: 'absolute', left: r.actionLeft * s, top: r.headerTop * s, width: r.actionSize * s, height: r.actionSize * s, borderRadius: r.actionSize * s / 2, backgroundColor: c.search, opacity: pressed ? 0.6 : 1, boxShadow: shadow, alignItems: 'center', justifyContent: 'center'})}><ChatIcon name="plus" size={29 * s} color={c.text}/></Pressable>}
      <View style={{position: 'absolute', left: r.searchLeft * s, top: r.searchTop * s, width: r.searchWidth * s}}>
        <DrawerGestureBoundary><View testID="sidebar-search" style={{height: r.searchHeight * s, borderRadius: r.searchHeight * s / 2, backgroundColor: c.search, borderWidth: isDark ? s : 0, borderColor: c.border, boxShadow: shadow, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 31 * s, gap: 14 * s}}>
          <ChatIcon name="search" size={29 * s} color={c.text}/>
          <TextInput accessibilityLabel={card ? '이 카드의 채팅 검색' : '카드 검색'} value={search} onChangeText={setSearch} placeholder="검색" placeholderTextColor={c.placeholder} selectionColor="#3096EB" underlineColorAndroid="transparent" returnKeyType="search" style={{flex: 1, minWidth: 0, padding: 0, color: c.text, height: r.searchHeight * s, fontSize: 27 * s, includeFontPadding: false}}/>
        </View></DrawerGestureBoundary>
      </View>
      <Text testID="sidebar-list-heading" style={{position: 'absolute', left: r.textInset * s, bottom: (r.listTop - r.labelTop - r.lineHeight) * s, color: c.muted, fontSize: r.fontSize * s, lineHeight: r.lineHeight * s, includeFontPadding: false}}>{card ? '채팅 기록' : '카드 목록'}</Text>
    </View>
    <FlatList
      testID={card ? 'card-conversation-list' : 'card-list'} data={items} keyExtractor={item => item.id} style={{flex: 1}}
      contentContainerStyle={{paddingHorizontal: r.rowInset * s, paddingBottom: 12 * s}}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      ListEmptyComponent={<Text style={{padding: 19 * s, color: c.muted, fontSize: 23 * s, lineHeight: 34 * s}}>{query ? '검색 결과가 없어요.' : card ? '아직 채팅이 없어요.' : '아직 카드가 없어요.'}</Text>}
      renderItem={({item}) => <Pressable testID={`sidebar-row-${item.id}`} accessibilityRole="button" accessibilityLabel={card ? `${item.title} 채팅 열기` : `${item.title} 카드의 채팅 기록`} accessibilityState={{selected: item.id === selectedId}} onPress={() => {void select(item.id).catch(error => w.report(error));}} style={({pressed}) => ({height: r.rowHeight * s, borderRadius: r.rowRadius * s, paddingHorizontal: (r.textInset - r.rowInset) * s, justifyContent: 'center', backgroundColor: pressed ? c.historyPressed : item.id === selectedId ? c.historySelected : 'transparent'})}>
        <Text numberOfLines={1} style={{color: c.text, fontSize: r.fontSize * s, lineHeight: r.lineHeight * s, fontWeight: '400', includeFontPadding: false}}>{item.title}</Text>
      </Pressable>}
    />
    <View testID="sidebar-footer" style={{height: (r.footerHeight + r.footerBottom) * s}}>
      <Pressable testID="sidebar-account" accessibilityRole="button" accessibilityLabel="사용자 계정" onPress={openSettings} style={({pressed}) => ({position: 'absolute', left: r.searchLeft * s, top: 0, width: r.searchWidth * s, height: r.footerHeight * s, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.6 : 1})}>
        <View accessible={false} style={{width: r.avatar * s, height: r.avatar * s, borderRadius: r.avatar * s / 2, backgroundColor: '#000000'}}/>
        <Text numberOfLines={1} style={{flex: 1, marginLeft: (r.accountNameLeft - r.searchLeft - r.avatar) * s, color: c.text, fontSize: 26 * s, lineHeight: 35 * s, fontWeight: '600', includeFontPadding: false}}>사용자</Text>
      </Pressable>
      <Pressable testID="sidebar-settings" accessibilityRole="button" accessibilityLabel="설정" onPress={openSettings} style={({pressed}) => ({position: 'absolute', left: r.actionLeft * s, top: 0, width: r.actionSize * s, height: r.actionSize * s, borderRadius: r.actionSize * s / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: c.search, opacity: pressed ? 0.6 : 1, boxShadow: shadow})}><ChatIcon name="settings" size={31 * s} color={c.text}/></Pressable>
    </View>
  </View>;
}
