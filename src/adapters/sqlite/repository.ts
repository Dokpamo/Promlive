import {SqliteLibraryFolderStore} from './libraryFolderStore';
import type {FolderRemoval} from '../../features/library/FolderLibrary';
import {z} from 'zod';
import type {SqlDatabase, SqlSession} from '../../ports/storage';
import type {StoryRepository} from '../../ports/repository';
import {cardSchema, draftSchema, newId, type Card, type Draft} from '../../features/cards/model';
import {conversationSchema, messageSchema, type Conversation, type Message} from '../../features/chat/model';
import {SqliteChatSessionStore} from './chatSessionStore';
import type {ChatSubmission, ComposerDraft} from '../../features/chat/sessionStore';
import type {CardMetadataPatch} from '../../features/cards/store';
import {projectSchema} from '../../features/authoring/model';
import {initialScene, normalizeScene, sceneStateSchema, type SceneState} from '../../features/cards/experience';
const bufferSchema = cardSchema.extend({title: z.string().max(120)});

export class RevisionConflict extends Error { constructor() { super('원본 카드가 변경되었습니다. 최신 내용과 초안을 비교한 뒤 다시 적용해 주세요.'); this.name = 'RevisionConflict'; } }
export class Repository implements StoryRepository {
  private readonly chatStore: SqliteChatSessionStore;
  readonly folderStore: SqliteLibraryFolderStore;
  constructor(readonly db: SqlDatabase) {this.chatStore = new SqliteChatSessionStore(db); this.folderStore = new SqliteLibraryFolderStore(db);}
  loadComposerDraft(id: string) {return this.chatStore.loadComposerDraft(id);}
  writeComposerDraft(id: string, draft: Pick<ComposerDraft, 'text' | 'revision'>) {return this.chatStore.writeComposerDraft(id, draft);}
  acceptChatSubmission(submission: ChatSubmission) {return this.chatStore.acceptChatSubmission(submission);}
  async listCards() {
    const cards = (await this.db.execute('SELECT document FROM cards ORDER BY updated_at DESC,id')).rows.map(row => cardSchema.parse(JSON.parse(String(row.document))));
    const draftIds = cards.filter(card => card.studioDraft).map(card => card.id);
    const drafts = new Map<string, ReturnType<typeof projectSchema.parse>>();
    if (draftIds.length) {
      const rows = (await this.db.execute(`SELECT document FROM authoring_projects WHERE card_id IN (${draftIds.map(() => '?').join(',')})`, draftIds)).rows;
      for (const row of rows) {const project = projectSchema.parse(JSON.parse(String(row.document))); drafts.set(project.cardId, project);}
    }
    const visible = cards.map(card => {
      const draft = drafts.get(card.id)?.draft;
      return draft ? {...card, title: draft.title.trim() || '제목 없는 카드', description: draft.description, coverAssetId: draft.coverAssetId} : card;
    });
    return visible.sort((a, b) => (b.pinnedAt ?? -1) - (a.pinnedAt ?? -1) || b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
  }
  async getCard(id: string, tx: SqlSession = this.db) {
    const row = (await tx.execute('SELECT document FROM cards WHERE id = ?', [id])).rows[0];
    if (!row) throw new Error('카드를 찾을 수 없습니다.');
    return cardSchema.parse(JSON.parse(String(row.document)));
  }
  async insertCard(input: Card) {
    const card = cardSchema.parse(input);
    await this.db.execute('INSERT INTO cards(id,title,kind,revision,updated_at,favorite,archived,document) VALUES(?,?,?,?,?,?,?,?)', [card.id, card.title, card.body.kind, card.revision, card.updatedAt, Number(card.favorite), Number(card.archived), JSON.stringify(card)]);
    return card;
  }
  private async updateCard(input: Card, expectedRevision: number, tx: SqlSession, preserveRecency = false) {
    const card = cardSchema.parse({...input, revision: expectedRevision + 1, updatedAt: preserveRecency ? input.updatedAt : Date.now()});
    const result = await tx.execute('UPDATE cards SET title=?,kind=?,revision=?,updated_at=?,favorite=?,archived=?,document=? WHERE id=? AND revision=?', [card.title, card.body.kind, card.revision, card.updatedAt, Number(card.favorite), Number(card.archived), JSON.stringify(card), card.id, expectedRevision]);
    if (result.changes !== 1) throw new RevisionConflict();
    return card;
  }
  async saveCard(card: Card, expectedRevision: number) {
    return this.db.transaction(async tx => {
      const saved = await this.updateCard(card, expectedRevision, tx);
      await tx.execute('DELETE FROM editor_buffers WHERE card_id=?', [card.id]);
      return saved;
    });
  }
  async saveBuffer(card: Card, baseRevision: number) {
    bufferSchema.parse(card);
    await this.db.execute('INSERT INTO editor_buffers(card_id,base_revision,document,updated_at) VALUES(?,?,?,?) ON CONFLICT(card_id) DO UPDATE SET base_revision=excluded.base_revision,document=excluded.document,updated_at=excluded.updated_at', [card.id, baseRevision, JSON.stringify(card), Date.now()]);
  }
  async getBuffer(id: string) {
    const row = (await this.db.execute('SELECT * FROM editor_buffers WHERE card_id=?', [id])).rows[0];
    return row ? {card: bufferSchema.parse(JSON.parse(String(row.document))), baseRevision: z.number().int().parse(row.base_revision)} : null;
  }
  async updateMetadata(id: string, patch: CardMetadataPatch) {
    if (patch.title !== undefined) patch = {...patch, title: z.string().trim().min(1, '이름을 입력해 주세요.').max(120).parse(patch.title)};
    return this.db.transaction(async tx => {
      const current = await this.getCard(id, tx);
      const titleChanged = patch.title !== undefined && patch.title !== current.title;
      const next = {...current, ...patch, ...(titleChanged && current.publishedVersion ? {publishedVersion: newId('card_version')} : {})};
      const saved = await this.updateCard(next, current.revision, tx, patch.favorite === undefined && patch.archived === undefined);
      if (titleChanged && current.publishedVersion) await tx.execute('INSERT INTO card_versions(id,card_id,document,created_at) VALUES(?,?,?,?)', [saved.publishedVersion!, id, JSON.stringify(saved), Date.now()]);
      const row = (await tx.execute('SELECT document,base_revision FROM editor_buffers WHERE card_id=?', [id])).rows[0];
      if (row && row.base_revision === current.revision) {
        const buffer = bufferSchema.parse(JSON.parse(String(row.document)));
        await tx.execute('UPDATE editor_buffers SET document=?,base_revision=? WHERE card_id=?', [JSON.stringify({...buffer, ...patch}), saved.revision, id]);
      }
      const studio = (await tx.execute('SELECT document FROM authoring_projects WHERE card_id=?', [id])).rows[0];
      if (studio) {
        const project = projectSchema.parse(JSON.parse(String(studio.document)));
        if (project.baseCardRevision === current.revision) {
          const metadata = {...patch};
          if (project.draft.title !== current.title) delete metadata.title;
          const revision = project.revision + Number(metadata.title !== undefined && metadata.title !== project.draft.title);
          await tx.execute('UPDATE authoring_projects SET document=?,revision=revision+1 WHERE card_id=?', [JSON.stringify({...project, revision,
            publishedDraftRevision: project.publishedDraftRevision === project.revision ? revision : project.publishedDraftRevision,
            baseCardRevision: saved.revision, draft: {...project.draft, ...metadata, revision: saved.revision, publishedVersion: saved.publishedVersion}}), id]);
        }
      }
      return saved;
    });
  }
  async deleteCard(id: string) {await this.deleteCards([id]);}
  async deleteCards(ids: readonly string[], folders?: FolderRemoval) {
    await this.db.transaction(async tx => {
      if (folders) await this.folderStore.removeIn(tx, folders, ids, 'card');
      for (const id of new Set(ids)) {
        await tx.execute("DELETE FROM settings WHERE key IN (SELECT 'composer:' || id FROM conversations WHERE card_id=?)", [id]);
        await tx.execute('DELETE FROM cards WHERE id=?', [id]);
      }
    });
  }
  async putDraft(input: Draft, tx: SqlSession = this.db) {
    const draft = draftSchema.parse(input);
    await tx.execute('INSERT INTO ai_drafts(id,card_id,created_at,document) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document', [draft.id, draft.cardId, draft.createdAt, JSON.stringify(draft)]);
  }
  async drafts(cardId: string) { return (await this.db.execute('SELECT document FROM ai_drafts WHERE card_id=? ORDER BY created_at DESC LIMIT 20', [cardId])).rows.map(row => draftSchema.parse(JSON.parse(String(row.document)))); }
  async applyDraft(draft: Draft, next: Card) {
    if (draft.status !== 'completed') throw new Error('완료된 초안만 적용할 수 있습니다.');
    if (draft.cardId !== next.id) throw new Error('초안의 대상 카드가 다릅니다.');
    return this.db.transaction(async tx => {
      const current = await this.getCard(next.id, tx);
      if (current.revision !== draft.baseRevision) throw new RevisionConflict();
      const buffered = (await tx.execute('SELECT card_id FROM editor_buffers WHERE card_id=?', [next.id])).rows.length;
      if (buffered) throw new RevisionConflict();
      const saved = await this.updateCard(next, draft.baseRevision, tx);
      await this.putDraft({...draft, status: 'applied'}, tx);
      return saved;
    });
  }
  async createConversation(cardId: string, title = '새로운 대화', startId?: string) {
    const now = Date.now();
    const item: Conversation = {id: newId('chat'), cardId, title, createdAt: now, updatedAt: now};
    await this.db.transaction(async tx => {
      const card = await this.getCard(cardId, tx);
      if (card.studioDraft) throw new Error('제작기에서 먼저 카드로 사용을 눌러 주세요.');
      await tx.execute('INSERT INTO conversations(id,card_id,title,created_at,updated_at,card_snapshot) VALUES(?,?,?,?,?,?)', [item.id, item.cardId, title, now, now, JSON.stringify(card)]);
      const scene = card.experience ? initialScene(card.experience, startId) : null;
      if (scene) await tx.execute('INSERT INTO conversation_scenes(conversation_id,document) VALUES(?,?)', [item.id, JSON.stringify(scene)]);
      const greeting = card.experience ? card.experience.starts.find(s => s.id === scene!.startId)?.greeting : card.body.kind === 'template' ? card.body.data.greeting : '';
      if (card.publishedVersion && greeting?.trim()) await this.insertMessage({id: newId('msg'), conversationId: item.id, sequence: 1, role: 'assistant', content: greeting, status: 'completed', requestId: null, error: null, createdAt: now}, tx);
    });
    return item;
  }
  async getConversationCard(id: string) {
    const row = (await this.db.execute('SELECT card_snapshot FROM conversations WHERE id=?', [id])).rows[0];
    return row?.card_snapshot ? cardSchema.parse(JSON.parse(String(row.card_snapshot))) : null;
  }
  async getSceneState(id: string) {
    const card = await this.getConversationCard(id);
    if (!card?.experience) return null;
    const row = (await this.db.execute('SELECT document FROM conversation_scenes WHERE conversation_id=?', [id])).rows[0];
    return normalizeScene(card.experience, row ? sceneStateSchema.parse(JSON.parse(String(row.document))) : null);
  }
  async setSceneState(id: string, input: SceneState) {
    const state = sceneStateSchema.parse(input);
    await this.db.transaction(async tx => {
      const row = (await tx.execute('SELECT card_snapshot FROM conversations WHERE id=?', [id])).rows[0];
      if (!row?.card_snapshot) throw new Error('대화를 찾을 수 없어요.');
      const card = cardSchema.parse(JSON.parse(String(row.card_snapshot)));
      if (!card.experience) throw new Error('이 카드에는 장면 설정이 없어요.');
      const normalized = normalizeScene(card.experience, state);
      await tx.execute('INSERT INTO conversation_scenes(conversation_id,document) VALUES(?,?) ON CONFLICT(conversation_id) DO UPDATE SET document=excluded.document', [id, JSON.stringify(normalized)]);
    });
  }
  async useCardVersion(conversationId: string, versionId: string) {
    await this.db.transaction(async tx => {
      const row = (await tx.execute('SELECT card_id,document FROM card_versions WHERE id=?', [versionId])).rows[0];
      if (!row) throw new Error('사용할 카드 버전을 찾을 수 없어요.');
      const result = await tx.execute('UPDATE conversations SET card_snapshot=? WHERE id=? AND card_id=?', [String(row.document), conversationId, String(row.card_id)]);
      if (result.changes !== 1) throw new Error('이 카드의 대화가 아니에요.');
    });
  }
  async conversations(cardId?: string) {
    const result = await this.db.execute(`
      SELECT c.id,c.card_id AS cardId,c.title,c.created_at AS createdAt,c.updated_at AS updatedAt,c.pinned_at AS pinnedAt,
        COALESCE((SELECT substr(m.content,1,180) FROM messages m
          WHERE m.conversation_id=c.id AND m.content<>'' ORDER BY m.sequence DESC LIMIT 1),'') AS preview
      FROM conversations c${cardId ? ' WHERE c.card_id=?' : ''} ORDER BY c.pinned_at DESC,c.updated_at DESC,c.id
    `, cardId ? [cardId] : []);
    return result.rows.map(row => conversationSchema.parse(row));
  }
  async renameConversation(id: string, title: string) {
    const text = z.string().trim().min(1, '이름을 입력해 주세요.').max(120, '이름은 120자까지 입력할 수 있어요.').parse(title);
    const result = await this.db.execute('UPDATE conversations SET title=?,title_edited=1 WHERE id=?', [text, id]);
    if (result.changes !== 1) throw new Error('채팅내역을 찾을 수 없습니다.');
  }
  async pinConversation(id: string, pinned: boolean) {
    const result = await this.db.execute('UPDATE conversations SET pinned_at=? WHERE id=?', [pinned ? Date.now() : null, id]);
    if (result.changes !== 1) throw new Error('채팅내역을 찾을 수 없습니다.');
  }
  async deleteConversations(ids: readonly string[], folders?: FolderRemoval) {
    await this.db.transaction(async tx => {
      if (folders) await this.folderStore.removeIn(tx, folders, ids, 'history');
      for (const id of new Set(ids)) {
        await tx.execute('DELETE FROM conversations WHERE id=?', [id]);
        await tx.execute('DELETE FROM settings WHERE key=?', [`composer:${id}`]);
      }
    });
  }
  async messages(conversationId: string, before = Number.MAX_SAFE_INTEGER, limit = 40) {
    const result = await this.db.execute('SELECT id,conversation_id AS conversationId,sequence,role,content,status,request_id AS requestId,error,created_at AS createdAt FROM messages WHERE conversation_id=? AND sequence<? ORDER BY sequence DESC LIMIT ?', [conversationId, before, Math.max(1, Math.min(limit, 200))]);
    return result.rows.map(row => messageSchema.parse(row)).reverse();
  }
  async beginExchange(conversationId: string, requestId: string, content: string) {
    return this.db.transaction(async tx => {
      const duplicate = (await tx.execute('SELECT id FROM messages WHERE request_id=? AND role=\'assistant\'', [requestId])).rows[0];
      if (duplicate) throw new Error('이미 보낸 요청입니다. 새 요청을 명시적으로 시작해 주세요.');
      const active = (await tx.execute("SELECT id FROM messages WHERE conversation_id=? AND status IN ('pending','generating')", [conversationId])).rows[0];
      if (active) throw new Error('진행 중인 응답을 먼저 마치거나 중단해 주세요.');
      const sequence = Number((await tx.execute('SELECT COALESCE(MAX(sequence),0) AS value FROM messages WHERE conversation_id=?', [conversationId])).rows[0]?.value) + 1;
      const now = Date.now();
      const user = messageSchema.parse({id: newId('msg'), conversationId, sequence, role: 'user', content, status: 'completed', requestId, error: null, createdAt: now});
      const assistant = messageSchema.parse({...user, id: newId('msg'), sequence: sequence + 1, role: 'assistant', content: '', status: 'pending'});
      for (const msg of [user, assistant]) await this.insertMessage(msg, tx);
      await tx.execute('UPDATE conversations SET updated_at=?,title=CASE WHEN title_edited=0 AND title=\'새로운 대화\' THEN ? ELSE title END WHERE id=?', [now, content.slice(0, 40), conversationId]);
      return {user, assistant};
    });
  }
  private async insertMessage(msg: Message, tx: SqlSession) {
    await tx.execute('INSERT INTO messages(id,conversation_id,sequence,role,content,status,request_id,error,created_at) VALUES(?,?,?,?,?,?,?,?,?)', [msg.id, msg.conversationId, msg.sequence, msg.role, msg.content, msg.status, msg.requestId, msg.error, msg.createdAt]);
  }
  async appendLocalUserMessage(conversationId: string, content: string) {
    const text = z.string().trim().min(1).max(8000).parse(content);
    return this.db.transaction(async tx => {
      const sequence = Number((await tx.execute('SELECT COALESCE(MAX(sequence),0) AS value FROM messages WHERE conversation_id=?', [conversationId])).rows[0]?.value) + 1;
      const message = messageSchema.parse({id: newId('msg'), conversationId, sequence, role: 'user', content: text, status: 'completed', requestId: null, error: null, createdAt: Date.now()});
      await this.insertMessage(message, tx);
      await tx.execute("UPDATE conversations SET updated_at=?,title=CASE WHEN title_edited=0 AND title='새로운 대화' THEN ? ELSE title END WHERE id=?", [message.createdAt, text.slice(0, 40), conversationId]);
      return message;
    });
  }
  async saveMessage(input: Message) {
    const msg = messageSchema.parse(input);
    const result = await this.db.execute('UPDATE messages SET content=?,status=?,error=? WHERE id=?', [msg.content, msg.status, msg.error, msg.id]);
    if (result.changes !== 1) throw new Error('응답을 저장하지 못했습니다.');
  }
  async recoverInterrupted() {
    await this.db.transaction(async tx => {
      await tx.execute("UPDATE messages SET status='interrupted',error='앱이 종료되어 생성이 중단되었습니다. 저장된 부분 응답입니다.' WHERE status IN ('pending','generating')");
      const drafts = (await tx.execute('SELECT document FROM ai_drafts')).rows;
      for (const row of drafts) {
        const draft = draftSchema.parse(JSON.parse(String(row.document)));
        if (draft.status === 'generating') await this.putDraft({...draft, status: 'failed', error: '앱이 종료되어 생성이 중단되었습니다.'}, tx);
      }
    });
  }
  async getSetting(key: string) { return (await this.db.execute('SELECT value FROM settings WHERE key=?', [key])).rows[0]?.value as string | undefined; }
  async setSetting(key: string, value: string) { await this.db.execute('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, value]); }
  async setSettings(entries: readonly {key: string; value: string}[]) {
    await this.db.transaction(async tx => {
      for (const {key, value} of entries) await tx.execute('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, value]);
    });
  }
}
