import type {WorkCard, ChatRow} from './model';
import type {CollectionScope, ChatMetadata, MessageQuery} from '../../ports/workspace';

export const normalizeSearch = (text: string) => text.normalize('NFKC').toLocaleLowerCase();

/** List rows contain no long prose, galleries or message bodies. */
export function cardProjection(card: WorkCard): WorkCard {
  const project = (content: WorkCard['draft']) => ({...content, summary: content.summary.slice(0, 180), introduction: '', guide: '', tags: [], gallery: []});
  return {...card, draft: project(card.draft), published: card.published && project(card.published)};
}
export function chatProjection(chat: ChatMetadata | ChatRow): ChatRow {
  return {id: chat.id, title: chat.title, character: chat.character, tile: chat.tile, lastChatAt: chat.lastChatAt,
    lastAssistantMessage: chat.lastAssistantMessage.slice(0, 180), messages: [], draft: '', draftImage: null};
}
export type IndexEntry = {key: string; scope: CollectionScope; filter: string; id: string; sort: number; search: string; value: WorkCard | ChatRow};
export function cardIndexes(card: WorkCard): IndexEntry[] {
  const value = cardProjection(card), rows: IndexEntry[] = [];
  const add = (scope: CollectionScope, filter: string, content: WorkCard['draft']) => rows.push({key: `${scope}:${filter}:${card.id}`,
    scope, filter, id: card.id, sort: -card.updatedAt, search: normalizeSearch(`${content.title} ${content.character} ${content.creator}${scope === 'create' ? ` ${content.summary}` : ''}`), value});
  if (card.published) for (const filter of ['all', card.activity]) add('library', filter, card.published);
  for (const filter of ['all', card.working ? 'draft' : 'ready', card.origin === 'created' ? 'mine' : 'external']) add('create', filter, card.draft);
  return rows;
}
export function chatIndex(chat: ChatMetadata | ChatRow): IndexEntry {
  return {key: `chats:all:${chat.id}`, scope: 'chats', filter: 'all', id: chat.id, sort: -chat.lastChatAt,
    search: normalizeSearch(`${chat.title} ${chat.character} ${chat.lastAssistantMessage}`), value: chatProjection(chat)};
}
export function metadata(chat: ChatRow): ChatMetadata {
  const {messages, ...value} = chat;
  return {...value, lastSequence: messages.length};
}
export function selectMessageHeads<T extends {sequence: number; characters: number}>(heads: T[], query: MessageQuery): T[] {
  const selected: T[] = []; let characters = 0;
  for (const head of heads) {
    if (selected.length && characters + head.characters > query.characters) break;
    selected.push(head); characters += head.characters;
    if (selected.length >= query.limit) break;
  }
  return selected;
}
