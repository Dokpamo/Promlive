import type {LibraryCard} from '../features/workspace/model';
import {usePalette, themedStyles} from './Theme';
import {useRef, type ReactNode} from 'react';
import {Animated, type FlatList, Pressable, Text, View} from 'react-native';
import {PreviewArtwork} from './PreviewArtwork';
import {filterChipsHeight, navigation} from './tokens';
import {useScrollHeader} from './useScrollHeader';
import {ScrollFrame} from './ScrollFrame';
import {FilterChips} from './FilterChips';
import type {ScreenMemoryController as ScreenMemory} from './ScreenController';
import type {LibraryFilter} from './screenState';
import {libraryFilters} from './swipeNavigation';
import {useWorkspaceRows} from './workspace/hooks';

type Props = {
  items: LibraryCard[];
  width: number;
  scale: number;
  header: ReactNode;
  query: string;
  memory: ScreenMemory;
  filter: LibraryFilter;
  onFilterChange: (filter: LibraryFilter) => void;
  onOpen: (id: string) => void;
};

/** Only completed snapshots open here; draft editing remains in the creation workspace. */
export function Library({items, width, scale, header, query, memory, filter, onFilterChange, onOpen}: Props) {
  const colors = usePalette();
  const styles = useStyles();
  const list = useRef<FlatList<LibraryCard>>(null);
  const gap = 3 * scale;
  const cardWidth = (width - gap * 2) / 3;
  const term = query.trim().normalize('NFKC').toLocaleLowerCase();
  const filtered = items.filter(card =>
    (filter === 'all' || card.activity === filter) &&
    `${card.title} ${card.character} ${card.creator}`.normalize('NFKC').toLocaleLowerCase().includes(term));
  const collection = useWorkspaceRows(memory, {scope: 'library', filter, search: query}, filtered);
  const scrolling = useScrollHeader(list, navigation.headerHeight * scale + filterChipsHeight(scale), JSON.stringify([width, query]), memory, `library:${filter}`, collection);
  const cards = collection.rows;

  const listHeader = <>
    {header}
    <FilterChips scope="library" items={libraryFilters} selected={filter} onChange={onFilterChange} scale={scale}/>
  </>;

  return <ScrollFrame scope="library" header={listHeader} scrolling={scrolling}>
    <Animated.FlatList ref={list} testID="ui-library-grid" data={cards} numColumns={3} keyExtractor={card => card.id}
      onEndReached={collection.loadMore} onEndReachedThreshold={2} windowSize={5} maxToRenderPerBatch={6}
      contentContainerStyle={scrolling.minimumContentStyle}
      style={styles.list} columnWrapperStyle={{gap}} ItemSeparatorComponent={() => <View style={{height: gap}}/>}
      ListHeaderComponent={<View testID="ui-library-header-space" pointerEvents="none" style={{height: scrolling.headerHeight}}/>}
      {...scrolling.scrollProps} scrollEventThrottle={16}
      removeClippedSubviews={false}
      showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"
      initialNumToRender={12}
      renderItem={({item}) => <Pressable testID={`ui-bot-card-${item.id}`} accessibilityRole="button" onPress={() => onOpen(item.id)}
        accessibilityLabel={`${item.title}, ${item.character}, 제작자 ${item.creator}, 상세 보기`}
        style={{width: cardWidth, backgroundColor: colors.background}}>
        <View testID={`ui-bot-cover-${item.id}`} style={styles.cover}>
          <PreviewArtwork tile={item.tile} width={cardWidth} height={cardWidth * 4 / 3}/>
        </View>
        <View style={styles.caption}>
          <Text numberOfLines={2} ellipsizeMode="tail" style={styles.cardTitle}>{item.title}</Text>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.cardCreator}>{item.creator}</Text>
        </View>
      </Pressable>}
      ListEmptyComponent={collection.ready ? <View testID="ui-library-no-results" style={styles.empty}>
        <Text style={styles.emptyTitle}>검색 결과가 없어요</Text>
        <Text style={styles.emptyHint}>다른 이름이나 제작자로 검색해 보세요.</Text>
      </View> : null}/>
  </ScrollFrame>;
}

const useStyles = themedStyles(colors => ({
  list: {flex: 1, backgroundColor: colors.background},
  cover: {width: '100%', aspectRatio: 3 / 4, overflow: 'hidden', backgroundColor: colors.surface},
  caption: {paddingTop: 7, paddingHorizontal: 7, paddingBottom: 12},
  cardTitle: {fontSize: 14, lineHeight: 19, fontWeight: '600', color: colors.foreground, includeFontPadding: false},
  cardCreator: {marginTop: 3, fontSize: 12, lineHeight: 17, color: colors.secondaryForeground, includeFontPadding: false},
  empty: {alignItems: 'center', paddingHorizontal: 24, paddingVertical: 64},
  emptyTitle: {fontSize: 17, fontWeight: '600', color: colors.foreground},
  emptyHint: {marginTop: 8, fontSize: 14, color: colors.secondaryForeground},
}));
