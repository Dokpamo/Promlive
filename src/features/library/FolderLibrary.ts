import {newId} from '../cards/model';
import type {FolderTree, LibraryFolder} from './folderTree';

export type LibraryScope = {kind: 'card'} | {kind: 'history'; cardId: string};
export interface FolderRemoval {scope: LibraryScope; folderIds: readonly string[]}
export type FolderChange =
  | {kind: 'move'; ids: readonly string[]; folderIds: readonly string[]; destination: string | null}
  | {kind: 'create'; folder: LibraryFolder; ids: readonly string[]; folderIds: readonly string[]}
  | {kind: 'rename'; id: string; name: string};
export interface FolderStore {
  read(scope: LibraryScope): Promise<FolderTree>;
  change(scope: LibraryScope, change: FolderChange): Promise<FolderTree>;
}
export interface FolderActions {
  move(ids: readonly string[], destination: string | null, folderIds?: readonly string[]): Promise<void>;
  createFolder(name: string, ids?: readonly string[], parentId?: string | null, folderIds?: readonly string[]): Promise<LibraryFolder>;
}

/** One observable owner per library. Storage resolves mutations against the latest tree. */
export class FolderLibrary implements FolderActions {
  private state = {value: {items: [], folders: []} as FolderTree, ready: false, error: ''};
  private listeners = new Set<() => void>();
  private revision = 0;
  constructor(readonly scope: LibraryScope, private readonly store: FolderStore) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  private emit() {for (const listener of this.listeners) listener();}
  private async update(load: () => Promise<FolderTree>, reading = false) {
    const revision = ++this.revision;
    try {
      const value = await load();
      if (revision === this.revision) {this.state = {value, ready: true, error: ''}; this.emit();}
    } catch (error) {
      if (reading && revision === this.revision) {this.state = {...this.state, error: '목록을 불러오지 못했어요.'}; this.emit();}
      throw error;
    }
  }
  refresh = () => this.update(() => this.store.read(this.scope), true);
  move = (ids: readonly string[], destination: string | null, folderIds: readonly string[] = []) => this.update(() => this.store.change(this.scope, {kind: 'move', ids, folderIds, destination}));
  createFolder = async (name: string, ids: readonly string[] = [], parentId: string | null = null, folderIds: readonly string[] = []) => {
    const folder = {id: newId('folder'), name, parentId};
    await this.update(() => this.store.change(this.scope, {kind: 'create', folder, ids, folderIds}));
    return folder;
  };
  renameFolder = (id: string, name: string) => this.update(() => this.store.change(this.scope, {kind: 'rename', id, name}));
}
