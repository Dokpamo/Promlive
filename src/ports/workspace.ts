import type {WorkCard, ChatMessage, ChatRow, GalleryImage, WorkspaceData} from '../features/workspace/model';

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
// Adapters round-trip presentation without knowing route or scroll types.
export type WorkspaceSeed = {data: WorkspaceData; view: unknown; positions: unknown};
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
