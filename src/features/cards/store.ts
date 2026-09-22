import type {Card, Draft} from './model';

export interface CardLibraryStore {
  listCards(): Promise<Card[]>;
  getCard(id: string): Promise<Card>;
  insertCard(card: Card): Promise<Card>;
  updateMetadata(id: string, patch: Partial<Pick<Card, 'favorite' | 'archived'>>): Promise<Card>;
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
