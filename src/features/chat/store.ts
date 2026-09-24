import type {FolderRemoval} from '../library/FolderLibrary';
import type {Conversation, Message} from './model';
import type {ChatSessionStore} from './sessionStore';
import type {DraftWriter, CardLibraryStore} from '../cards/store';

export interface ConversationStore {
  createConversation(cardId: string, title?: string): Promise<Conversation>;
  conversations(cardId?: string): Promise<Conversation[]>;
  renameConversation(id: string, title: string): Promise<void>;
  pinConversation(id: string, pinned: boolean): Promise<void>;
  deleteConversations(ids: readonly string[], folders?: FolderRemoval): Promise<void>;
}

export interface MessageReader {
  messages(conversationId: string, before?: number, limit?: number): Promise<Message[]>;
}

export interface MessageStore extends MessageReader {
  beginExchange(conversationId: string, requestId: string, content: string): Promise<{user: Message; assistant: Message}>;
  appendLocalUserMessage(conversationId: string, content: string): Promise<Message>;
  saveMessage(message: Message): Promise<void>;
}

/** Only operations used by generation and its cancellation-before-delete boundary. */
export interface CreationStore extends MessageReader, DraftWriter,
  Pick<MessageStore, 'beginExchange' | 'saveMessage'>,
  Pick<ConversationStore, 'deleteConversations' | 'conversations'>,
  Pick<CardLibraryStore, 'deleteCards'>,
  Pick<ChatSessionStore, 'acceptChatSubmission'> {}
