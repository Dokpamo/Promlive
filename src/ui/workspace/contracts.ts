import type {ChatRow} from '../../features/workspace/model';
import type {CollectionPage, StoredMessage} from '../../ports/workspace';

export type CollectionState = CollectionPage & {ready: boolean; loading: boolean; error: boolean};
export type RoomState = {chat: ChatRow; messages: StoredMessage[]; hasOlder: boolean; hasNewer: boolean; ready: boolean; loading: boolean; error: boolean};
interface Observable<State> {
  snapshot(): State;
  subscribe(listener: () => void): () => void;
}
export interface CollectionView extends Observable<CollectionState> {
  load(): Promise<void>;
  loadMore(): Promise<void>;
  refresh(): Promise<void>;
}
export interface RoomView extends Observable<RoomState> {
  older(): Promise<void>;
  newer(): Promise<void>;
  latest(): Promise<void>;
  retain(firstVisible: string, lastVisible: string): void;
}
