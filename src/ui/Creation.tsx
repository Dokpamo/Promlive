import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Animated, AppState, type FlatList, StyleSheet, Text, View} from 'react-native';
import {ContentRow} from './ContentRow';
import {FilterChips} from './FilterChips';
import {creationFilters, type CreationFilter} from './creationPreview';
import {filteredWorkCards, type WorkCard} from './cardWorkspace';
import {formatChatTimestamp} from './chatTimestamp';
import {ScrollFrame} from './ScrollFrame';
import {SearchField} from './SearchField';
import {colors, filterChipsHeight, navigation} from './tokens';
import {useScrollHeader} from './useScrollHeader';

export function Creation({cards, width, scale, header, searchOpen, query, onQueryChange, onCloseSearch, onOpen}: {
  cards: WorkCard[];
  width: number;
  scale: number;
  header: ReactNode;
  searchOpen: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  onCloseSearch: () => void;
  onOpen: (id: string) => void;
}) {
  const [filter, setFilter] = useState<CreationFilter>('all');
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 60_000);
    const subscription = AppState.addEventListener('change', state => {if (state === 'active') refresh();});
    return () => {clearInterval(timer); subscription.remove();};
  }, []);
  const list = useRef<FlatList<WorkCard>>(null);
  const scrolling = useScrollHeader(list, navigation.headerHeight * scale + filterChipsHeight(scale), JSON.stringify([width, searchOpen, query, filter]));
  const listHeader = <>
    {header}
    <FilterChips scope="create" items={creationFilters} selected={filter} onChange={setFilter} scale={scale}/>
    {searchOpen && <SearchField scope="create" query={query} onQueryChange={onQueryChange} onClose={onCloseSearch}/>}
  </>;
  return <ScrollFrame scope="create" header={listHeader} scrolling={scrolling}>
    <Animated.FlatList ref={list} testID="ui-create-list" data={filteredWorkCards(cards, filter, query)} extraData={now}
      keyExtractor={item => item.id} style={styles.list}
      ListHeaderComponent={<View testID="ui-create-header-space" pointerEvents="none" style={{height: scrolling.headerHeight}}/>}
      {...scrolling.scrollProps} scrollEventThrottle={16} removeClippedSubviews={false}
      showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" initialNumToRender={12}
      renderItem={({item}) => {
        const timestamp = formatChatTimestamp(item.updatedAt, now);
        const title = item.draft.title.trim() || '제목 없는 카드';
        const status = item.working ? '작업 중' : '완성';
        const subtitle = `${item.origin === 'external' ? '외부 카드 · ' : ''}${status} · ${item.draft.summary || '내용을 추가해 보세요.'}`;
        return <ContentRow scope="creation" id={item.id} title={title} subtitle={subtitle}
          timestamp={timestamp} tile={item.draft.tile}
          accessibilityLabel={`${title}, ${subtitle}, 마지막 수정 ${timestamp}, 편집하기`}
          onPress={() => onOpen(item.id)}/>;
      }}
      ListEmptyComponent={<View testID="ui-create-no-results" style={styles.empty}>
        <Text style={styles.emptyTitle}>검색 결과가 없어요</Text>
        <Text style={styles.emptyHint}>다른 제목이나 캐릭터로 검색해 보세요.</Text>
      </View>}/>
  </ScrollFrame>;
}

const styles = StyleSheet.create({
  list: {flex: 1, backgroundColor: colors.background},
  empty: {alignItems: 'center', paddingHorizontal: 24, paddingVertical: 64},
  emptyTitle: {fontSize: 17, fontWeight: '600', color: colors.foreground},
  emptyHint: {marginTop: 8, fontSize: 14, color: colors.secondaryForeground},
});
