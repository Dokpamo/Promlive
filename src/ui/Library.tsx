import {useEffect, useRef, type ReactNode} from 'react';
import {Animated, type FlatList, StyleSheet, Text, View} from 'react-native';
import type {LibraryCard} from './cardWorkspace';
import {PreviewArtwork} from './PreviewArtwork';
import {SearchField} from './SearchField';
import {colors, filterChipsHeight, navigation} from './tokens';
import {useScrollHeader} from './useScrollHeader';
import {ScrollFrame} from './ScrollFrame';
import {FilterChips} from './FilterChips';
import type {ScreenMemory} from './ScreenMemory';
import type {LibraryFilter} from './screenState';

const filters = [
  {id: 'all', label: '전체'},
  {id: 'recent', label: '요즘 한 거'},
  {id: 'idle', label: '방치 중'},
] as const;

type Props = {
  items: LibraryCard[];
  width: number;
  scale: number;
  header: ReactNode;
  searchOpen: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  onCloseSearch: () => void;
  memory: ScreenMemory;
  filter: LibraryFilter;
  onFilterChange: (filter: LibraryFilter) => void;
};

/** A new presentation-only library. Card opening/import will be connected separately. */
export function Library({items, width, scale, header, searchOpen, query, onQueryChange, onCloseSearch, memory, filter, onFilterChange}: Props) {
  const restoringSearch = useRef(true);
  useEffect(() => {restoringSearch.current = false;}, []);
  const list = useRef<FlatList<LibraryCard>>(null);
  const scrolling = useScrollHeader(list, navigation.headerHeight * scale + filterChipsHeight(scale), JSON.stringify([width, filter, searchOpen, query]), memory, 'library');
  const gap = 3 * scale;
  const cardWidth = (width - gap * 2) / 3;
  const term = query.trim().normalize('NFKC').toLocaleLowerCase();
  const cards = items.filter(card =>
    (filter === 'all' || card.activity === filter) &&
    `${card.title} ${card.character} ${card.creator}`.normalize('NFKC').toLocaleLowerCase().includes(term));

  const listHeader = <>
    {header}
    <FilterChips scope="library" items={filters} selected={filter} onChange={onFilterChange} scale={scale}/>
    {searchOpen && <SearchField scope="library" query={query} onQueryChange={onQueryChange} onClose={onCloseSearch} autoFocus={!restoringSearch.current}/>}
  </>;

  return <ScrollFrame scope="library" header={listHeader} scrolling={scrolling}>
    <Animated.FlatList ref={list} testID="ui-library-grid" data={cards} numColumns={3} keyExtractor={card => card.id}
      style={styles.list} columnWrapperStyle={{gap}} ItemSeparatorComponent={() => <View style={{height: gap}}/>}
      ListHeaderComponent={<View testID="ui-library-header-space" pointerEvents="none" style={{height: scrolling.headerHeight}}/>}
      {...scrolling.scrollProps} scrollEventThrottle={16}
      removeClippedSubviews={false}
      showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"
      initialNumToRender={12}
      renderItem={({item}) => <View testID={`ui-bot-card-${item.id}`} accessible
        accessibilityLabel={`${item.title}, ${item.character}, 제작자 ${item.creator}, 미리보기`}
        style={{width: cardWidth, backgroundColor: colors.background}}>
        <View testID={`ui-bot-cover-${item.id}`} style={styles.cover}>
          <PreviewArtwork tile={item.tile} width={cardWidth} height={cardWidth * 4 / 3}/>
        </View>
        <View style={styles.caption}>
          <Text numberOfLines={2} ellipsizeMode="tail" style={styles.cardTitle}>{item.title}</Text>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.cardCreator}>{item.creator}</Text>
        </View>
      </View>}
      ListEmptyComponent={<View testID="ui-library-no-results" style={styles.empty}>
        <Text style={styles.emptyTitle}>검색 결과가 없어요</Text>
        <Text style={styles.emptyHint}>다른 이름이나 제작자로 검색해 보세요.</Text>
      </View>}/>
  </ScrollFrame>;
}

const styles = StyleSheet.create({
  list: {flex: 1, backgroundColor: colors.background},
  cover: {width: '100%', aspectRatio: 3 / 4, overflow: 'hidden', backgroundColor: colors.surface},
  caption: {paddingTop: 7, paddingHorizontal: 7, paddingBottom: 12},
  cardTitle: {fontSize: 14, lineHeight: 19, fontWeight: '600', color: colors.foreground, includeFontPadding: false},
  cardCreator: {marginTop: 3, fontSize: 12, lineHeight: 17, color: colors.secondaryForeground, includeFontPadding: false},
  empty: {alignItems: 'center', paddingHorizontal: 24, paddingVertical: 64},
  emptyTitle: {fontSize: 17, fontWeight: '600', color: colors.foreground},
  emptyHint: {marginTop: 8, fontSize: 14, color: colors.secondaryForeground},
});
