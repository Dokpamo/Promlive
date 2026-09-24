import {useMemo, useSyncExternalStore, type RefObject} from 'react';
import type {ConversationList} from './ConversationList';
import type {Card} from '../cards/model';
import type {Conversation} from './model';
import {CardConversationHeader} from './ChatHistory';
import {ManagedItemList} from '../../layout/ManagedItemList';
import type {SheetScrollState} from '../../layout/sheetMotion';

export function CardConversationPanel({history, openConversation, report, scale, card, search, close, onClose, scroll, onListTouch}: {
  history: ConversationList; openConversation: (conversation: Conversation) => Promise<void>; report: (error: unknown) => void; scale: number; card: Card; search: string;
  close: () => void; onClose: () => void; scroll: RefObject<SheetScrollState>; onListTouch: () => void;
}) {
  useSyncExternalStore(history.subscribe, history.snapshot);
  const query = search.trim().toLocaleLowerCase();
  const allItems = useMemo(() => history.items.filter(item => item.cardId === card.id), [history.items, card.id]);
  const conversations = useMemo(() => allItems.filter(item => `${item.title} ${item.preview ?? ''}`.toLocaleLowerCase().includes(query)), [allItems, query]);
  return <ManagedItemList scope="history" items={conversations} allItems={allItems} library={history.folderLibrary(card.id)} search={search} selectedId={history.selected?.id} scale={scale}
    actions={history} report={report} resetKey={`${card.id}:${query}`} empty={query ? '검색 결과가 없어요.' : '아직 채팅이 없어요.'}
    onOpen={item => {void openConversation(item).then(close).catch(report);}} scroll={scroll} onListTouch={onListTouch}
    header={({selecting, cancel}) => <CardConversationHeader card={card} scale={scale} onClose={selecting ? cancel : onClose} closeLabel={selecting ? '선택 취소' : '채팅내역 닫기'}/>}/>;
}
