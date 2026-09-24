import {View} from 'react-native';
import type {Card} from './model';
import type {CardListActions} from './store';
import {CardThumbnail} from './CardThumbnail';
import {ManagedItemList} from '../../layout/ManagedItemList';
import {referenceSidebar as r} from '../chat/chatAppearance';

export function CardList({cards, allCards, actions, selectedId, scale: s, search, active, openCard, report}: {
  cards: readonly Card[]; allCards: readonly Card[]; actions: CardListActions; selectedId?: string | undefined;
  scale: number; search: string; active: boolean; openCard: (card: Card) => void; report: (error: unknown) => void;
}) {
  return <ManagedItemList scope="card" items={cards} allItems={allCards} actions={actions} library={actions.folders} search={search} selectedId={selectedId} scale={s}
    active={active} resetKey={search} empty={search ? '검색 결과가 없어요.' : '아직 카드가 없어요.'} onOpen={openCard} report={report}
    geometry={{rowHeight: r.rowHeight, lineHeight: r.lineHeight, fontSize: r.fontSize, padding: r.textInset - r.rowInset, inset: r.rowInset, radius: r.rowRadius, highlightInset: 0}}
    leading={card => <View style={{marginRight: r.cardImageGap * s}}><CardThumbnail testID={`sidebar-card-image-${card.id}`} cover={card.cover} size={r.cardImage * s}/></View>}/>
}
