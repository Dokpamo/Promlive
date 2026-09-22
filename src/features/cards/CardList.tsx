import {Animated, Text, View} from 'react-native';
import type {Card} from './model';
import type {CardListActions} from './store';
import {CardThumbnail} from './CardThumbnail';
import {ManagedItemList} from '../../layout/ManagedItemList';
import {HeaderButton} from '../../layout/ScreenHeader';
import {referenceSidebar as r} from '../chat/chatAppearance';
import {useAppearance} from '../appearance/AppAppearance';

export function CardList({cards, allCards, actions, selectedId, scale: s, search, active, openCard, report}: {
  cards: readonly Card[]; allCards: readonly Card[]; actions: CardListActions; selectedId?: string | undefined;
  scale: number; search: string; active: boolean; openCard: (card: Card) => void; report: (error: unknown) => void;
}) {
  const {colors: c} = useAppearance();
  return <ManagedItemList scope="card" items={cards} allItems={allCards} actions={actions} selectedId={selectedId} scale={s}
    active={active} resetKey={search} empty={search ? '검색 결과가 없어요.' : '아직 카드가 없어요.'} onOpen={openCard} report={report}
    geometry={{rowHeight: r.rowHeight, lineHeight: r.lineHeight, fontSize: r.fontSize, padding: r.textInset - r.rowInset, inset: r.rowInset, radius: r.rowRadius, highlightInset: 0}}
    leading={card => <View style={{marginRight: r.cardImageGap * s}}><CardThumbnail testID={`sidebar-card-image-${card.id}`} cover={card.cover} size={r.cardImage * s}/></View>}
    header={({selecting, count, cancel, selection}) => selection.present && <Animated.View pointerEvents={selecting ? 'auto' : 'none'} aria-hidden={!selecting}
      style={{height: selection.progress.interpolate({inputRange: [0, 1], outputRange: [0, 76 * s]}), opacity: selection.progress, overflow: 'hidden'}}>
      <View style={{height: 76 * s, paddingLeft: r.textInset * s, paddingRight: r.rowInset * s, flexDirection: 'row', alignItems: 'center'}}>
        <Text style={{flex: 1, color: c.muted, fontSize: 24 * s}}>{count}개 선택</Text>
        <HeaderButton width={r.viewportWidth * s} variant="plain" icon="close" label="카드 선택 취소" onPress={cancel}/>
      </View>
    </Animated.View>}/>;
}
