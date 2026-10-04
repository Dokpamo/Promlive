import type {EditableCardField, GalleryImage} from '../../features/workspace/model';
import type {ScreenMemoryController} from '../ScreenController';
import type {ScreenView, SearchState} from '../screenState';

let cardNumber = 0;
/** Data edits shared by both shells; each shell owns its navigation and animation. */
export function screenCommands(memory: ScreenMemoryController) {
  return {
    search(scope: keyof ScreenView['searches'], change: Partial<SearchState>) {
      memory.updateView(view => ({...view, searches: {...view.searches, [scope]: {...view.searches[scope], ...change}}}));
    },
    createCard() {
      const now = Date.now(), id = `created-${now}-${++cardNumber}`;
      memory.dispatchCard({type: 'create', id, now});
      return id;
    },
    editCard(id: string, field: EditableCardField, value: string) {
      memory.dispatchCard({type: 'edit', id, field, value, now: Date.now()});
    },
    setGallery(id: string, images: GalleryImage[]) {
      memory.dispatchCard({type: 'gallery', id, images, now: Date.now()});
    },
    completeCard(id: string) {memory.dispatchCard({type: 'complete', id, now: Date.now()});},
  };
}
