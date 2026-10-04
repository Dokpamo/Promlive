import {NativeModules} from 'react-native';
import {SqliteWorkspace} from './SqliteWorkspace';
import type {WorkspaceStorage, WorkspaceCache} from './types';

export function createWorkspace() {
  let pending: Promise<WorkspaceStorage> | undefined;
  const storage = () => pending ??= import('../../app/runtime').then(async ({initialize}) => {
    const db = (await initialize()).database; if (!db) throw new Error('Workspace database unavailable'); return new SqliteWorkspace(db, false);
  }).catch(error => {pending = undefined; throw error;});
  const store: WorkspaceStorage = {
    initialize: seed => storage().then(db => db.initialize(seed)),
    list: (query, cursor, limit) => storage().then(db => db.list(query, cursor, limit)),
    card: id => storage().then(db => db.card(id)), chat: id => storage().then(db => db.chat(id)),
    messages: (id, query) => storage().then(db => db.messages(id, query)),
    saveCard: (card, expected) => storage().then(db => db.saveCard(card, expected)),
    createChat: chat => storage().then(db => db.createChat(chat)),
    saveDraft: (id, text, image, expected) => storage().then(db => db.saveDraft(id, text, image, expected)),
    send: (id, message, expected) => storage().then(db => db.send(id, message, expected)),
    async close() {},
  };
  const native = NativeModules.PromliveScreenMemory as {readCacheSync(): {value?: string; error?: string}; writeCache(value: string): Promise<void>};
  const cache: WorkspaceCache = {read: () => {const row = native.readCacheSync(); if (row.error) throw new Error(row.error); return row.value ?? null;},
    write: value => native.writeCache(value)};
  return {store, cache};
}
