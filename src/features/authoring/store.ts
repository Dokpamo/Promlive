import type {Card} from '../cards/model';
import type {AuthoringProject} from './model';
import type {CardAsset} from './assets';
export type {CardAsset} from './assets';

export interface StoredProject {project: AuthoringProject; storageRevision: number}
export interface AuthoringStore {
  open(cardId: string): Promise<StoredProject>;
  save(project: AuthoringProject, expectedStorageRevision: number): Promise<number>;
  publish(project: AuthoringProject, expectedStorageRevision: number): Promise<StoredProject & {card: Card}>;
  putAsset(image: Omit<CardAsset, 'id'>): Promise<CardAsset>;
  getAsset(id: string): Promise<CardAsset | null>;
  importBundle(text: string): Promise<Card>;
}
