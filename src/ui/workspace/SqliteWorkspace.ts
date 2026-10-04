import type {SqlDatabase, SqlSession} from '../../ports/storage';
import {ScreenStorageConflict} from '../screenPersistence';
import type {WorkCard} from '../cardWorkspace';
import type {ChatRow} from '../screenState';
import type {ChatMessage} from '../chatConversation';
import type {GalleryImage} from '../cardDetails';
import {cardIndexes, chatIndex, metadata, normalizeSearch, selectMessageHeads, workspaceVersion,
  type WorkspaceStorage, type WorkspaceSeed, type CollectionQuery, type Cursor, type IndexEntry,
  type ChatMetadata, type MessageQuery, type StoredMessage, type Stored} from './types';

export const workspaceSchema = [
  'CREATE TABLE IF NOT EXISTS pl_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS pl_cards (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, document TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS pl_chats (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, document TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS pl_messages (chat_id TEXT NOT NULL, sequence INTEGER NOT NULL, id TEXT NOT NULL UNIQUE, role TEXT NOT NULL, content TEXT NOT NULL, sent_at INTEGER NOT NULL, image TEXT, characters INTEGER NOT NULL, PRIMARY KEY(chat_id,sequence))',
  'CREATE TABLE IF NOT EXISTS pl_index (key TEXT PRIMARY KEY, scope TEXT NOT NULL, filter TEXT NOT NULL, id TEXT NOT NULL, sort REAL NOT NULL, search TEXT NOT NULL, document TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS pl_index_page ON pl_index(scope,filter,sort,id)',
  'CREATE INDEX IF NOT EXISTS pl_index_entity ON pl_index(id,scope)',
  // Select page sizes without visiting the overflow pages of long message bodies.
  'CREATE INDEX IF NOT EXISTS pl_message_heads ON pl_messages(chat_id,sequence,characters)',
];

export class SqliteWorkspace implements WorkspaceStorage {
  constructor(private db: SqlDatabase, private ownsDatabase = true) {}
  async initialize(seed: () => Promise<WorkspaceSeed>) {
    for (const sql of workspaceSchema) await this.db.execute(sql);
    const version = await this.version(this.db);
    if (version !== null) {if (version !== workspaceVersion) throw new Error('Unsupported workspace version'); return this.presentation(this.db);}
    const initial = await seed();
    return this.db.transaction(async tx => {
      const current = await this.version(tx);
      if (current !== null) {if (current !== workspaceVersion) throw new Error('Unsupported workspace version'); return this.presentation(tx);}
      for (const card of initial.data.cards) {
        await tx.execute('INSERT INTO pl_cards VALUES(?,?,?)', [card.id, 1, JSON.stringify(card)]);
        await this.index(tx, cardIndexes(card));
      }
      for (const chat of initial.data.chats) await this.insertChat(tx, chat);
      await tx.execute('INSERT INTO pl_meta VALUES(?,?)', ['version', String(workspaceVersion)]);
      await tx.execute('INSERT INTO pl_meta VALUES(?,?)', ['presentation', JSON.stringify({view: initial.view, positions: initial.positions})]);
      // The migration marker and all rows commit together. The original snapshot is retained.
      return initial;
    });
  }
  private async presentation(tx: SqlSession): Promise<WorkspaceSeed | null> {
    const row = (await tx.execute("SELECT value FROM pl_meta WHERE key='presentation'")).rows[0];
    return row ? {data: {cards: [], chats: []}, ...JSON.parse(String(row.value))} as WorkspaceSeed : null;
  }
  private async version(tx: SqlSession) {
    const row = (await tx.execute("SELECT value FROM pl_meta WHERE key='version'")).rows[0];
    return row ? Number(row.value) : null;
  }
  private async index(tx: SqlSession, entries: IndexEntry[]) {
    for (const row of entries) await tx.execute('INSERT OR REPLACE INTO pl_index VALUES(?,?,?,?,?,?,?)',
      [row.key, row.scope, row.filter, row.id, row.sort, row.search, JSON.stringify(row.value)]);
  }
  async list(query: CollectionQuery, cursor: Cursor | null, limit: number) {
    limit = Math.max(1, Math.min(200, Math.floor(limit)));
    const search = normalizeSearch(query.search.trim());
    const result = await this.db.execute(`SELECT id,sort,document FROM pl_index WHERE scope=? AND filter=?
      ${cursor ? 'AND (sort,id)>(?,?)' : ''} ${search ? 'AND instr(search,?)>0' : ''} ORDER BY sort,id LIMIT ?`,
    [query.scope, query.filter, ...(cursor ? [cursor.sort, cursor.id] : []), ...(search ? [search] : []), Math.min(200, limit) + 1]);
    const rows = result.rows.slice(0, limit).map(row => ({id: String(row.id), sort: Number(row.sort), value: JSON.parse(String(row.document)) as WorkCard | ChatRow}));
    const last = rows.at(-1);
    return {rows, next: result.rows.length > limit && last ? {id: last.id, sort: last.sort} : null};
  }
  private async get<T>(table: 'pl_cards' | 'pl_chats', id: string, tx: SqlSession = this.db): Promise<Stored<T> | null> {
    const row = (await tx.execute(`SELECT revision,document FROM ${table} WHERE id=?`, [id])).rows[0];
    return row ? {value: JSON.parse(String(row.document)) as T, revision: Number(row.revision)} : null;
  }
  card(id: string) {return this.get<WorkCard>('pl_cards', id);}
  chat(id: string) {return this.get<ChatMetadata>('pl_chats', id);}
  async messages(id: string, query: MessageQuery) {
    const forwards = query.after !== undefined;
    const heads = (await this.db.execute(`SELECT sequence,characters FROM pl_messages WHERE chat_id=?
      ${forwards ? 'AND sequence>?' : query.before !== undefined ? 'AND sequence<?' : ''}
      ORDER BY sequence ${forwards ? 'ASC' : 'DESC'} LIMIT ?`,
    [id, ...(forwards ? [query.after!] : query.before !== undefined ? [query.before] : []), Math.min(200, query.limit)])).rows
      .map(row => ({sequence: Number(row.sequence), characters: Number(row.characters)}));
    const selected = selectMessageHeads(heads, query);
    if (!selected.length) return {messages: [], hasOlder: false, hasNewer: false};
    const sequences = selected.map(row => row.sequence);
    const messages = (await this.db.execute(`SELECT * FROM pl_messages WHERE chat_id=? AND sequence IN (${sequences.map(() => '?').join(',')}) ORDER BY sequence`, [id, ...sequences])).rows.map(row => ({
      id: String(row.id), sequence: Number(row.sequence), role: row.role as ChatMessage['role'], text: String(row.content), sentAt: Number(row.sent_at),
      ...(row.image ? {image: JSON.parse(String(row.image)) as GalleryImage} : {}),
    }));
    const edges = (await this.db.execute('SELECT (SELECT sequence FROM pl_messages WHERE chat_id=? ORDER BY sequence LIMIT 1) AS first,(SELECT sequence FROM pl_messages WHERE chat_id=? ORDER BY sequence DESC LIMIT 1) AS last', [id, id])).rows[0]!;
    return {messages, hasOlder: Number(edges.first) < messages[0]!.sequence, hasNewer: Number(edges.last) > messages.at(-1)!.sequence};
  }
  async saveCard(card: WorkCard, expected: number) {
    return this.db.transaction(async tx => {
      if (expected === 0) {
        const result = await tx.execute('INSERT INTO pl_cards VALUES(?,?,?) ON CONFLICT(id) DO NOTHING', [card.id, 1, JSON.stringify(card)]);
        if (result.changes !== 1) throw new ScreenStorageConflict();
      } else {
        const result = await tx.execute('UPDATE pl_cards SET document=?,revision=revision+1 WHERE id=? AND revision=?', [JSON.stringify(card), card.id, expected]);
        if (result.changes !== 1) throw new ScreenStorageConflict();
      }
      await tx.execute("DELETE FROM pl_index WHERE id=? AND scope IN ('library','create')", [card.id]);
      await this.index(tx, cardIndexes(card));
      return expected + 1;
    });
  }
  private async insertMessage(tx: SqlSession, id: string, message: StoredMessage) {
    await tx.execute('INSERT INTO pl_messages VALUES(?,?,?,?,?,?,?,?)', [id, message.sequence, message.id, message.role, message.text,
      message.sentAt, message.image ? JSON.stringify(message.image) : null, message.text.length]);
  }
  private async insertChat(tx: SqlSession, chat: ChatRow) {
    const value = metadata(chat);
    await tx.execute('INSERT INTO pl_chats VALUES(?,?,?)', [chat.id, 1, JSON.stringify(value)]);
    await this.index(tx, [chatIndex(value)]);
    for (let index = 0; index < chat.messages.length; index++) await this.insertMessage(tx, chat.id, {...chat.messages[index]!, sequence: index + 1});
    return {value, revision: 1};
  }
  createChat(chat: ChatRow) {
    return this.db.transaction(async tx => await this.get<ChatMetadata>('pl_chats', chat.id, tx) ?? this.insertChat(tx, chat));
  }
  async saveDraft(id: string, draft: string, image: GalleryImage | null, expected: number) {
    return this.db.transaction(async tx => {
      const current = await this.get<ChatMetadata>('pl_chats', id, tx);
      if (!current || current.revision !== expected) throw new ScreenStorageConflict();
      await tx.execute('UPDATE pl_chats SET document=?,revision=revision+1 WHERE id=?', [JSON.stringify({...current.value, draft, draftImage: image}), id]);
      return expected + 1;
    });
  }
  send(id: string, message: ChatMessage, expected: number) {
    return this.db.transaction(async tx => {
      const current = await this.get<ChatMetadata>('pl_chats', id, tx);
      if (!current) throw new Error('Chat not found');
      const previous = (await tx.execute('SELECT sequence,content FROM pl_messages WHERE chat_id=? AND id=?', [id, message.id])).rows[0];
      if (previous) {
        if (String(previous.content) !== message.text) throw new ScreenStorageConflict();
        return {...current, message: {...message, sequence: Number(previous.sequence)}};
      }
      if (current.revision !== expected) throw new ScreenStorageConflict();
      const stored = {...message, sequence: current.value.lastSequence + 1};
      await this.insertMessage(tx, id, stored);
      const value = {...current.value, lastSequence: stored.sequence, lastChatAt: message.sentAt, draft: '', draftImage: null};
      await tx.execute('UPDATE pl_chats SET document=?,revision=revision+1 WHERE id=?', [JSON.stringify(value), id]);
      await this.index(tx, [chatIndex(value)]);
      return {value, revision: expected + 1, message: stored};
    });
  }
  async close() {if (this.ownsDatabase) await this.db.close();}
}
