import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Animated, AppState, type FlatList, StyleSheet, Text, View} from 'react-native';
import {chatPreviewRows} from './chatPreview';
import {formatChatTimestamp} from './chatTimestamp';
import {ContentRow} from './ContentRow';
import {SearchField} from './SearchField';
import {colors, navigation} from './tokens';
import {useScrollHeader} from './useScrollHeader';
import {ScrollFrame} from './ScrollFrame';

type Props = {
  width: number;
  scale: number;
  header: ReactNode;
  searchOpen: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  onCloseSearch: () => void;
};

/** New chat-list presentation only; opening a real conversation is a separate step. */
export function Chats({width, scale, header, searchOpen, query, onQueryChange, onCloseSearch}: Props) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 60_000);
    const subscription = AppState.addEventListener('change', state => {if (state === 'active') refresh();});
    return () => {clearInterval(timer); subscription.remove();};
  }, []);
  const list = useRef<FlatList<typeof chatPreviewRows[number]>>(null);
  const scrolling = useScrollHeader(list, navigation.headerHeight * scale, JSON.stringify([width, searchOpen, query]));
  const term = query.trim().normalize('NFKC').toLocaleLowerCase();
  const chats = chatPreviewRows.filter(chat =>
    `${chat.title} ${chat.character} ${chat.lastAssistantMessage}`.normalize('NFKC').toLocaleLowerCase().includes(term));
  const listHeader = <>
    {header}
    {searchOpen && <SearchField scope="chats" query={query} onQueryChange={onQueryChange} onClose={onCloseSearch}/>}
  </>;

  return <ScrollFrame scope="chats" header={listHeader} scrolling={scrolling}>
    <Animated.FlatList ref={list} testID="ui-chats-list" data={chats} extraData={now} keyExtractor={chat => chat.id}
    style={styles.list} ListHeaderComponent={<View testID="ui-chats-header-space" pointerEvents="none" style={{height: scrolling.headerHeight}}/>}
    {...scrolling.scrollProps}
    scrollEventThrottle={16}
    removeClippedSubviews={false} showsVerticalScrollIndicator={false}
    keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" initialNumToRender={12}
    renderItem={({item}) => {
      const timestamp = formatChatTimestamp(item.lastChatAt, now);
      return <ContentRow scope="chat" id={item.id} title={item.title} subtitle={item.lastAssistantMessage}
        timestamp={timestamp} tile={item.tile} accessibilityLabel={`${item.title}, 마지막 대화 ${timestamp}, ${item.lastAssistantMessage}`}/>;
    }}
    ListEmptyComponent={<View testID="ui-chats-no-results" style={styles.empty}>
      <Text style={styles.emptyTitle}>검색 결과가 없어요</Text>
      <Text style={styles.emptyHint}>다른 제목이나 메시지로 검색해 보세요.</Text>
    </View>}/>
  </ScrollFrame>;
}

const styles = StyleSheet.create({
  list: {flex: 1, backgroundColor: colors.background},
  empty: {alignItems: 'center', paddingHorizontal: 24, paddingVertical: 64},
  emptyTitle: {fontSize: 17, fontWeight: '600', color: colors.foreground},
  emptyHint: {marginTop: 8, fontSize: 14, color: colors.secondaryForeground},
});
