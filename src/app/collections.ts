import type {Card} from '../features/cards/model';
import type {Conversation} from '../features/chat/model';
import {folderPath, type FolderTree} from '../features/library/folderTree';

export const generalChatCardId = 'promlive-general-chat';
export const libraryCards = (cards: readonly Card[]) => cards.filter(card => card.id !== generalChatCardId && !card.archived && !card.studioDraft);
export function categoryCards(cards: readonly Card[], tree: FolderTree, category: string | null) {
  if (!category) return cards;
  const included = new Set(tree.items.filter(item => folderPath(tree, item.folderId).some(folder => folder.id === category)).map(item => item.id));
  return cards.filter(card => included.has(card.id));
}
export const cardCreatorName = (card: Card, localName: string) => card.creator || (card.origin === 'imported' || card.example ? '제작자 미상' : localName);
// Existing local cards predate the origin field; keep them in the author's collection.
export const createdCards = (cards: readonly Card[]) => cards.filter(card => card.id !== generalChatCardId && !card.archived && !card.example && card.origin !== 'imported');
export function conversationCards(cards: readonly Card[], conversations: readonly Conversation[], query = '') {
  const search = query.trim().toLocaleLowerCase();
  const groups = new Map<string, Conversation[]>();
  for (const room of conversations) groups.set(room.cardId, [...(groups.get(room.cardId) ?? []), room]);
  return cards.flatMap(card => {
    const rooms = groups.get(card.id);
    if (!rooms?.length) return [];
    const latest = rooms.reduce((a, b) => a.updatedAt >= b.updatedAt ? a : b);
    if (search && !`${card.title} ${rooms.map(room => `${room.title} ${room.preview ?? ''}`).join(' ')}`.toLocaleLowerCase().includes(search)) return [];
    return [{card, count: rooms.length, latest}];
  }).sort((a, b) => b.latest.updatedAt - a.latest.updatedAt);
}
