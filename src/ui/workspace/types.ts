import type {WorkCard} from '../cardWorkspace';
import type {ChatMessage} from '../chatConversation';
import type {ChatRow, ScreenSnapshot} from '../screenState';
import type {GalleryImage} from '../cardDetails';

export const workspaceVersion = 2;
export const workspaceDatabase = 'promlive-workspace-v2';
export type CollectionScope = 'library' | 'create' | 'chats';
export type CollectionQuery = {scope: CollectionScope; filter: string; search: string};
export type Cursor = {sort: number; id: string};
export type CollectionRow = {id: string; sort: number; value: WorkCard | ChatRow};
export type CollectionPage = {rows: CollectionRow[]; next: Cursor | null};
export type Stored<T> = {value: T; revision: number};
export type StoredMessage = ChatMessage & {sequence: number};
export type MessageQuery = {before?: number; after?: number; limit: number; characters: number};
export type MessagePage = {messages: StoredMessage[]; hasOlder: boolean; hasNewer: boolean};
export type ChatMetadata = Omit<ChatRow, 'messages'> & {lastSequence: number};
export type WorkspaceSeed = Pick<ScreenSnapshot, 'data' | 'view' | 'positions'>;
export interface WorkspaceStorage {
  /** The old snapshot is read only when no committed workspace exists. */
  initialize(seed: () => Promise<WorkspaceSeed>): Promise<WorkspaceSeed | null>;
  list(query: CollectionQuery, cursor: Cursor | null, limit: number): Promise<CollectionPage>;
  card(id: string): Promise<Stored<WorkCard> | null>;
  chat(id: string): Promise<Stored<ChatMetadata> | null>;
  messages(id: string, query: MessageQuery): Promise<MessagePage>;
  saveCard(card: WorkCard, expected: number): Promise<number>;
  createChat(chat: ChatRow): Promise<Stored<ChatMetadata>>;
  saveDraft(id: string, draft: string, image: GalleryImage | null, expected: number): Promise<number>;
  send(id: string, message: ChatMessage, expected: number): Promise<Stored<ChatMetadata> & {message: StoredMessage}>;
  close(): Promise<void>;
}
export interface WorkspaceCache {
  read(): string | null;
  write(value: string): Promise<void>;
}
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
