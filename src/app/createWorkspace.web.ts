import {IndexedWorkspace} from '../adapters/indexeddb/IndexedWorkspace';
import {workspaceDatabase, type WorkspaceCache} from '../ports/workspace';

export function createWorkspace(name = workspaceDatabase) {
  const key = `${name}:cache`;
  const cache: WorkspaceCache = {read: () => window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key),
    async write(value) {window.localStorage.setItem(key, value); window.sessionStorage.setItem(key, value);}};
  return {store: new IndexedWorkspace(name), cache};
}
