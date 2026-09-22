import type {Card, Draft} from '../features/cards/model';
import type {Conversation, Message} from '../features/chat/model';

/** Domain storage contract. UI and generation logic do not depend on SQL or native modules. */
export interface StoryRepository {
  listCards(): Promise<Card[]>;
  getCard(id: string): Promise<Card>;
  insertCard(card: Card): Promise<Card>;
  saveCard(card: Card, expectedRevision: number): Promise<Card>;
  saveBuffer(card: Card, baseRevision: number): Promise<void>;
  getBuffer(id: string): Promise<{card: Card; baseRevision: number} | null>;
  updateMetadata(id: string, patch: Partial<Pick<Card, 'favorite' | 'archived'>>): Promise<Card>;
  putDraft(draft: Draft): Promise<void>;
  drafts(cardId: string): Promise<Draft[]>;
  applyDraft(draft: Draft, next: Card): Promise<Card>;
  createConversation(cardId: string, title?: string): Promise<Conversation>;
  conversations(cardId?: string): Promise<Conversation[]>;
  messages(conversationId: string, before?: number, limit?: number): Promise<Message[]>;
  beginExchange(conversationId: string, requestId: string, content: string): Promise<{user: Message; assistant: Message}>;
  appendLocalUserMessage(conversationId: string, content: string): Promise<Message>;
  saveMessage(message: Message): Promise<void>;
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
}
