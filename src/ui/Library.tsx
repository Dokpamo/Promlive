import {FlatList, Image, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {Icon} from './Icon';
import {libraryPreviewAtlas} from './images/libraryPreview';
import {libraryPreviewCards} from './libraryPreview';
import {colors} from './tokens';

type Props = {
  width: number;
  scale: number;
  searchOpen: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  onCloseSearch: () => void;
};

/** A new presentation-only library. Card opening/import will be connected separately. */
export function Library({width, scale, searchOpen, query, onQueryChange, onCloseSearch}: Props) {
  const gap = 3 * scale;
  const cardWidth = (width - gap * 2) / 3;
  const term = query.trim().normalize('NFKC').toLocaleLowerCase();
  const cards = libraryPreviewCards.filter(card =>
    `${card.title} ${card.character} ${card.creator}`.normalize('NFKC').toLocaleLowerCase().includes(term));

  return <>
    {searchOpen && <View testID="ui-library-search" style={styles.searchRow}>
      <View style={styles.searchField}>
        <Icon name="search" size={22}/>
        <TextInput testID="ui-library-search-input" accessibilityLabel="카드 검색어" autoFocus
          value={query} onChangeText={onQueryChange} placeholder="카드 검색" placeholderTextColor="#87898E"
          autoCorrect={false} autoCapitalize="none" returnKeyType="search" underlineColorAndroid="transparent"
          style={styles.searchInput}/>
        {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="검색어 지우기"
          onPress={() => onQueryChange('')} style={styles.clearButton}>
          <Icon name="close" size={18}/>
        </Pressable>}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="검색 닫기" onPress={onCloseSearch} style={styles.cancelButton}>
        <Text style={styles.cancelText}>취소</Text>
      </Pressable>
    </View>}
    <FlatList testID="ui-library-grid" data={cards} numColumns={3} keyExtractor={card => card.id}
      style={styles.list} columnWrapperStyle={{gap}} contentContainerStyle={{gap}}
      showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"
      initialNumToRender={12}
      renderItem={({item}) => <View testID={`ui-bot-card-${item.id}`} accessible
        accessibilityLabel={`${item.title}, ${item.character}, 제작자 ${item.creator}, 미리보기`}
        style={{width: cardWidth, backgroundColor: colors.background}}>
        <View testID={`ui-bot-cover-${item.id}`} style={styles.cover}>
          <PreviewCover tile={item.tile} width={cardWidth}/>
        </View>
        <View style={styles.caption}>
          <Text numberOfLines={2} ellipsizeMode="tail" style={styles.cardTitle}>{item.title}</Text>
          <Text numberOfLines={2} ellipsizeMode="tail" style={styles.cardCreator}>{item.creator}</Text>
        </View>
      </View>}
      ListEmptyComponent={<View testID="ui-library-no-results" style={styles.empty}>
        <Text style={styles.emptyTitle}>검색 결과가 없어요</Text>
        <Text style={styles.emptyHint}>다른 이름이나 제작자로 검색해 보세요.</Text>
      </View>}/>
  </>;
}

/** Each square atlas cell is centre-cropped to fill its 3:4 portrait frame. */
function PreviewCover({tile, width}: {tile: number; width: number}) {
  const cell = width * 4 / 3;
  return <Image accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    source={libraryPreviewAtlas} fadeDuration={0} resizeMode="stretch"
    style={{position: 'absolute', width: cell * 3, height: cell * 4,
      left: -(tile % 3) * cell - (cell - width) / 2, top: -Math.floor(tile / 3) * cell}}/>;
}

const styles = StyleSheet.create({
  list: {flex: 1, backgroundColor: colors.background},
  cover: {width: '100%', aspectRatio: 3 / 4, overflow: 'hidden', backgroundColor: '#F1F2F4'},
  caption: {paddingTop: 7, paddingHorizontal: 7, paddingBottom: 12},
  cardTitle: {fontSize: 14, lineHeight: 19, fontWeight: '600', color: colors.foreground, includeFontPadding: false},
  cardCreator: {marginTop: 3, fontSize: 12, lineHeight: 17, color: '#6B6B70', includeFontPadding: false},
  searchRow: {flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 8, paddingTop: 4, paddingBottom: 16, gap: 4},
  searchField: {flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 44, borderRadius: 14, paddingLeft: 12, backgroundColor: '#F1F2F5'},
  searchInput: {flex: 1, minWidth: 0, paddingHorizontal: 8, paddingVertical: 10, fontSize: 16, color: colors.foreground},
  clearButton: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  cancelButton: {minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center'},
  cancelText: {fontSize: 15, color: colors.foreground},
  empty: {alignItems: 'center', paddingHorizontal: 24, paddingVertical: 64},
  emptyTitle: {fontSize: 17, fontWeight: '600', color: colors.foreground},
  emptyHint: {marginTop: 8, fontSize: 14, color: '#87898E'},
});
