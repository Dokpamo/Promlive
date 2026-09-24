import type {FolderLibrary, FolderRemoval} from '../library/FolderLibrary';
import type {Card, Draft} from './model';

export type CardMetadataPatch = Partial<Pick<Card, 'title' | 'pinnedAt' | 'favorite' | 'archived'>>;

export interface CardListActions {
  readonly folders?: FolderLibrary;
  rename(id: string, title: string): Promise<void>;
  pin(id: string, pinned: boolean): Promise<void>;
  remove(ids: readonly string[], folders?: FolderRemoval): Promise<void>;
}

export interface CardLibraryStore {
  listCards(): Promise<Card[]>;
  getCard(id: string): Promise<Card>;
  insertCard(card: Card): Promise<Card>;
  updateMetadata(id: string, patch: CardMetadataPatch): Promise<Card>;
  deleteCards(ids: readonly string[], folders?: FolderRemoval): Promise<void>;
}

export interface CardEditorStore {
  getCard(id: string): Promise<Card>;
  saveCard(card: Card, expectedRevision: number): Promise<Card>;
  saveBuffer(card: Card, baseRevision: number): Promise<void>;
  getBuffer(id: string): Promise<{card: Card; baseRevision: number} | null>;
  drafts(cardId: string): Promise<Draft[]>;
  applyDraft(draft: Draft, next: Card): Promise<Card>;
}

export interface DraftWriter {
  putDraft(draft: Draft): Promise<void>;
}
