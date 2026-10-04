import type {CardAction, LibraryCard, GalleryImage, ChatMessage, ChatRow} from '../features/workspace/model';
import type {ScreenState, ScreenView, ScrollMemory, ScrollScope} from './screenState';
import type {CollectionQuery} from '../ports/workspace';
import type {CollectionView, RoomView} from './workspace/contracts';

/** The view depends on capabilities, independently of persistence implementation. */
export interface ScreenMemoryController {
  getSnapshot(): ScreenState;
  subscribe(listener: () => void): () => void;
  updateView(update: (view: ScreenView) => ScreenView): void;
  dispatchCard(action: CardAction): void;
  ensureChat(card: LibraryCard): void;
  updateChatDraft(id: string, draft: string): void;
  updateChatImage(id: string, image: GalleryImage | null): void;
  sendChat(id: string, image?: GalleryImage): ChatMessage | undefined;
  getScroll(scope: ScrollScope): ScrollMemory;
  rememberScroll(scope: ScrollScope, position: ScrollMemory): void;
  resetScroll(scope: ScrollScope): void;
  flush(): Promise<void>;
  refresh(): Promise<void>;
  workspace?: {
    collection(query: CollectionQuery): CollectionView;
    room(id: string, fallback: ChatRow): RoomView | undefined;
  };
}
