import type {CardLibraryStore, CardEditorStore, DraftWriter} from '../features/cards/store';
import type {ConversationStore, MessageStore} from '../features/chat/store';
import type {ChatSessionStore} from '../features/chat/sessionStore';
import type {SettingsStore} from './settings';

/** Composition root and adapter contract. Features consume the smaller contracts directly. */
export interface StoryRepository extends CardLibraryStore, CardEditorStore, DraftWriter,
  ConversationStore, MessageStore, ChatSessionStore, SettingsStore {}
