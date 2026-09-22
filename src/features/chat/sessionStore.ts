import type {Message} from './model';

export interface ComposerDraft {text: string; revision: number; acceptedRevision: number}
export interface ChatSubmission {id: string; conversationId: string; text: string; draftRevision: number; generate: boolean}
export interface AcceptedSubmission {user: Message; assistant: Message | undefined; replayed: boolean}

/** A sent draft cannot be resurrected by an older write. Acceptance is durable and idempotent. */
export interface ChatSessionStore {
  loadComposerDraft(conversationId: string): Promise<ComposerDraft>;
  writeComposerDraft(conversationId: string, draft: Pick<ComposerDraft, 'text' | 'revision'>): Promise<void>;
  acceptChatSubmission(submission: ChatSubmission): Promise<AcceptedSubmission>;
}
