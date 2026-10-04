import type {WorkCard, ChatRow, ChatMessage, GalleryImage} from '../../features/workspace/model';
import {ScreenStorageConflict} from '../../ports/screenStorage';
import {cardIndexes, chatIndex, metadata, normalizeSearch, selectMessageHeads, type IndexEntry} from '../../features/workspace/indexing';
import {workspaceDatabase, workspaceVersion, type WorkspaceStorage, type WorkspaceSeed, type CollectionQuery, type Cursor, type ChatMetadata, type MessageQuery, type StoredMessage, type Stored, type CollectionPage} from '../../ports/workspace';

const stores = ['meta', 'cards', 'chats', 'index', 'heads', 'messages'];
const result = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);});
type Entity<T> = Stored<T> & {id: string};
type MessageHead = {chatId: string; sequence: number; characters: number};
type MessageRecord = StoredMessage & {chatId: string};

/** Every edit writes only its records. No database export or full-history JSON. */
export class IndexedWorkspace implements WorkspaceStorage {
  private opening: Promise<IDBDatabase> | undefined;
  constructor(private name = workspaceDatabase) {}
  private database() {
    return this.opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      let abandoned = false;
      const request = indexedDB.open(this.name, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('meta');
        db.createObjectStore('cards', {keyPath: 'id'});
        db.createObjectStore('chats', {keyPath: 'id'});
        const index = db.createObjectStore('index', {keyPath: 'key'});
        index.createIndex('page', ['scope', 'filter', 'sort', 'id'], {unique: true});
        index.createIndex('entity', 'id');
        db.createObjectStore('heads', {keyPath: ['chatId', 'sequence']});
        db.createObjectStore('messages', {keyPath: ['chatId', 'sequence']}).createIndex('id', 'id', {unique: true});
      };
      request.onsuccess = () => {const db = request.result; if (abandoned) {db.close(); return;}
        db.onversionchange = () => {db.close(); this.opening = undefined;}; resolve(db);};
      request.onerror = () => {this.opening = undefined; reject(request.error);};
      request.onblocked = () => {abandoned = true; this.opening = undefined; reject(new Error('Workspace upgrade is blocked by another tab'));};
    });
  }
  private async transaction<T>(names: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => Promise<T>) {
    const tx = (await this.database()).transaction(names, mode);
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error('Workspace transaction aborted'));
      tx.onerror = () => reject(tx.error);
    });
    // Install a rejection handler before requests run, including explicit aborts.
    void done.catch(() => {});
    try {const value = await work(tx); await done;
      if (mode === 'readwrite' && typeof window !== 'undefined') {
        // A data-only signal: cache/scroll writes never bounce refreshes between tabs.
        try {window.localStorage.setItem(`${this.name}:change`, `${Date.now()}:${Math.random()}`);} catch { /* IDB remains authoritative. */ }
      }
      return value;}
    catch (error) {try {tx.abort();} catch { /* The failing transaction may already have aborted. */ } await done.catch(() => {}); throw error;}
  }
  async initialize(seed: () => Promise<WorkspaceSeed>) {
    const version = await this.transaction(['meta'], 'readonly', tx => result(tx.objectStore('meta').get('version')));
    if (version !== undefined) {if (version !== workspaceVersion) throw new Error('Unsupported workspace version'); return this.presentation();}
    const initial = await seed();
    return this.transaction(stores, 'readwrite', async tx => {
      const current = await result(tx.objectStore('meta').get('version'));
      if (current !== undefined) {if (current !== workspaceVersion) throw new Error('Unsupported workspace version'); return null;}
      for (const card of initial.data.cards) {
        tx.objectStore('cards').add({id: card.id, value: card, revision: 1});
        for (const row of cardIndexes(card)) tx.objectStore('index').put(row);
      }
      for (const chat of initial.data.chats) this.insertChat(tx, chat);
      tx.objectStore('meta').put(workspaceVersion, 'version');
      tx.objectStore('meta').put({view: initial.view, positions: initial.positions}, 'presentation');
      return initial;
    });
  }
  private presentation(): Promise<WorkspaceSeed | null> {
    return this.transaction(['meta'], 'readonly', async tx => {
      const saved = await result(tx.objectStore('meta').get('presentation'));
      return saved ? {data: {cards: [], chats: []}, ...saved} as WorkspaceSeed : null;
    });
  }
  list(query: CollectionQuery, cursor: Cursor | null, limit: number): Promise<CollectionPage> {
    const search = normalizeSearch(query.search.trim());
    const size = Math.max(1, Math.min(200, Math.floor(limit)));
    return this.transaction(['index'], 'readonly', async tx => {
      const rows: CollectionPage['rows'] = [];
      const upper = [query.scope, query.filter, Number.MAX_VALUE, '\uffff'];
      let after = cursor;
      const index = tx.objectStore('index').index('page'), batch = search ? 256 : size + 1;
      for (;;) {
        const lower = [query.scope, query.filter, after?.sort ?? -Number.MAX_VALUE, after?.id ?? ''];
        // Batched keyset reads avoid one browser/database round trip per card.
        const entries = await result(index.getAll(IDBKeyRange.bound(lower, upper, !!after), batch)) as IndexEntry[];
        for (const entry of entries) if (!search || entry.search.includes(search)) {
          if (rows.length === size) {const last = rows.at(-1)!; return {rows, next: {id: last.id, sort: last.sort}};}
          rows.push({id: entry.id, sort: entry.sort, value: entry.value});
        }
        if (entries.length < batch) return {rows, next: null};
        const last = entries.at(-1)!; after = {id: last.id, sort: last.sort};
      }
    });
  }
  private async get<T>(table: 'cards' | 'chats', id: string): Promise<Stored<T> | null> {
    return this.transaction([table], 'readonly', async tx => (await result(tx.objectStore(table).get(id)) as Entity<T> | undefined) ?? null);
  }
  card(id: string) {return this.get<WorkCard>('cards', id);}
  chat(id: string) {return this.get<ChatMetadata>('chats', id);}
  messages(id: string, query: MessageQuery) {
    return this.transaction(['heads', 'messages'], 'readonly', async tx => {
      const forwards = query.after !== undefined;
      const range = IDBKeyRange.bound([id, forwards ? query.after! : 0], [id, !forwards && query.before !== undefined ? query.before : Number.MAX_SAFE_INTEGER], forwards, !forwards && query.before !== undefined);
      const heads = await new Promise<MessageHead[]>((resolve, reject) => {
        const rows: MessageHead[] = [];
        let characters = 0;
        const request = tx.objectStore('heads').openCursor(range, forwards ? 'next' : 'prev');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {const cursor = request.result;
          if (!cursor || rows.length >= Math.min(200, query.limit)) {resolve(rows); return;}
          const head = cursor.value as MessageHead;
          if (rows.length && characters + head.characters > query.characters) {resolve(rows); return;}
          rows.push(head); characters += head.characters; cursor.continue();
        };
      });
      const selected = selectMessageHeads(heads, query);
      if (!selected.length) return {messages: [], hasOlder: false, hasNewer: false};
      const messages = (await Promise.all(selected.map(head => result(tx.objectStore('messages').get([id, head.sequence])) as Promise<MessageRecord>)))
        .map(({chatId: _chatId, ...message}) => message).sort((a, b) => a.sequence - b.sequence);
      const all = IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]);
      const [first, last] = await Promise.all(['next', 'prev'].map(direction => result(tx.objectStore('heads').openKeyCursor(all, direction as IDBCursorDirection))));
      return {messages, hasOlder: !!first && Number((first.key as IDBValidKey[])[1]) < messages[0]!.sequence,
        hasNewer: !!last && Number((last.key as IDBValidKey[])[1]) > messages.at(-1)!.sequence};
    });
  }
  saveCard(card: WorkCard, expected: number) {
    return this.transaction(['cards', 'index'], 'readwrite', async tx => {
      const current = await result(tx.objectStore('cards').get(card.id)) as Entity<WorkCard> | undefined;
      if ((current?.revision ?? 0) !== expected) throw new ScreenStorageConflict();
      tx.objectStore('cards').put({id: card.id, value: card, revision: expected + 1});
      await new Promise<void>((resolve, reject) => {
        const request = tx.objectStore('index').index('entity').openCursor(card.id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {const cursor = request.result; if (!cursor) {resolve(); return;}
          if ((cursor.value as IndexEntry).scope !== 'chats') cursor.delete(); cursor.continue();};
      });
      for (const row of cardIndexes(card)) tx.objectStore('index').put(row);
      return expected + 1;
    });
  }
  private insertMessage(tx: IDBTransaction, id: string, message: StoredMessage) {
    tx.objectStore('messages').add({...message, chatId: id});
    tx.objectStore('heads').add({chatId: id, sequence: message.sequence, characters: message.text.length});
  }
  private insertChat(tx: IDBTransaction, chat: ChatRow) {
    const row = {id: chat.id, value: metadata(chat), revision: 1};
    tx.objectStore('chats').put(row); tx.objectStore('index').put(chatIndex(row.value));
    chat.messages.forEach((message, index) => this.insertMessage(tx, chat.id, {...message, sequence: index + 1}));
    return row;
  }
  createChat(chat: ChatRow) {
    return this.transaction(['chats', 'index', 'heads', 'messages'], 'readwrite', async tx =>
      (await result(tx.objectStore('chats').get(chat.id)) as Entity<ChatMetadata> | undefined) ?? this.insertChat(tx, chat));
  }
  saveDraft(id: string, draft: string, image: GalleryImage | null, expected: number) {
    return this.transaction(['chats'], 'readwrite', async tx => {
      const current = await result(tx.objectStore('chats').get(id)) as Entity<ChatMetadata> | undefined;
      if (!current || current.revision !== expected) throw new ScreenStorageConflict();
      tx.objectStore('chats').put({...current, revision: expected + 1, value: {...current.value, draft, draftImage: image}});
      return expected + 1;
    });
  }
  send(id: string, message: ChatMessage, expected: number) {
    return this.transaction(['chats', 'index', 'heads', 'messages'], 'readwrite', async tx => {
      const current = await result(tx.objectStore('chats').get(id)) as Entity<ChatMetadata> | undefined;
      if (!current) throw new Error('Chat not found');
      const previous = await result(tx.objectStore('messages').index('id').get(message.id)) as MessageRecord | undefined;
      if (previous) {
        if (previous.chatId !== id || previous.text !== message.text) throw new ScreenStorageConflict();
        const {chatId: _chatId, ...stored} = previous; return {...current, message: stored};
      }
      if (current.revision !== expected) throw new ScreenStorageConflict();
      const stored = {...message, sequence: current.value.lastSequence + 1};
      this.insertMessage(tx, id, stored);
      const value = {...current.value, lastSequence: stored.sequence, lastChatAt: message.sentAt, draft: '', draftImage: null};
      const row = {id, revision: expected + 1, value};
      tx.objectStore('chats').put(row); tx.objectStore('index').put(chatIndex(value));
      return {...row, message: stored};
    });
  }
  async close() {const opening = this.opening; this.opening = undefined; (await opening)?.close();}
}
