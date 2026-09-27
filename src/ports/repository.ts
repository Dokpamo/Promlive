import type {FolderStore} from '../features/library/FolderLibrary';
import type {CardLibraryStore, CardEditorStore, DraftWriter} from '../features/cards/store';
import type {ConversationStore, MessageStore} from '../features/chat/store';
import type {ChatSessionStore} from '../features/chat/sessionStore';
import type {SettingsStore} from './settings';
import type {Card} from '../features/cards/model';
import type {SceneState} from '../features/cards/experience';

/** Composition root and adapter contract. Features consume the smaller contracts directly. */
export interface StoryRepository extends CardLibraryStore, CardEditorStore, DraftWriter,
  ConversationStore, MessageStore, ChatSessionStore, SettingsStore {
  readonly folderStore: FolderStore;
  getConversationCard?(id: string): Promise<Card | null>;
  getSceneState?(id: string): Promise<SceneState | null>;
  setSceneState?(id: string, state: SceneState): Promise<void>;
}
