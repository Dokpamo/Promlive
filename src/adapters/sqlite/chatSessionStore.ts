import {z} from 'zod';
import type {SqlDatabase, SqlSession} from '../../ports/storage';
import type {ChatSessionStore, ChatSubmission, ComposerDraft} from '../../features/chat/sessionStore';
import {messageSchema, type Message} from '../../features/chat/model';
import {newId} from '../../features/cards/model';

const revisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1);
const submissionSchema = z.object({id: z.string().min(1).max(120), conversationId: z.string().min(1), text: z.string().max(8000).refine(text => !!text.trim()), draftRevision: revisionSchema, generate: z.boolean()}).strict();
const messageColumns = 'id,conversation_id AS conversationId,sequence,role,content,status,request_id AS requestId,error,created_at AS createdAt';

export class SqliteChatSessionStore implements ChatSessionStore {
  constructor(private readonly db: SqlDatabase) {}
  async loadComposerDraft(conversationId: string): Promise<ComposerDraft> {
    const row = (await this.db.execute('SELECT text,revision,accepted_revision AS acceptedRevision FROM composer_drafts WHERE conversation_id=?', [conversationId])).rows[0];
    return row ? {text: String(row.text), revision: Number(row.revision), acceptedRevision: Number(row.acceptedRevision)} : {text: '', revision: 0, acceptedRevision: -1};
  }
  async writeComposerDraft(conversationId: string, draft: Pick<ComposerDraft, 'text' | 'revision'>) {
    z.string().max(8000).parse(draft.text); revisionSchema.parse(draft.revision);
    await this.db.execute(`INSERT INTO composer_drafts(conversation_id,text,revision)
      SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM conversations WHERE id=?)
      ON CONFLICT(conversation_id) DO UPDATE SET text=excluded.text,revision=excluded.revision
      WHERE excluded.revision>composer_drafts.revision AND excluded.revision>composer_drafts.accepted_revision`,
    [conversationId, draft.text, draft.revision, conversationId]);
  }
  async acceptChatSubmission(input: ChatSubmission) {
    const item = submissionSchema.parse(input);
    return this.db.transaction(async tx => {
      const existing = (await tx.execute('SELECT * FROM chat_submissions WHERE id=?', [item.id])).rows[0];
      if (existing) {
        if (existing.conversation_id !== item.conversationId || existing.text !== item.text || Number(existing.draft_revision) !== item.draftRevision || Boolean(existing.generate) !== item.generate) throw new Error('같은 전송 ID의 내용이 달라졌습니다.');
        const user = await this.message(String(existing.user_message_id), tx);
        const assistant = existing.assistant_message_id ? await this.message(String(existing.assistant_message_id), tx) : undefined;
        return {user, assistant, replayed: true};
      }
      const draft = (await tx.execute('SELECT accepted_revision FROM composer_drafts WHERE conversation_id=?', [item.conversationId])).rows[0];
      if (draft && Number(draft.accepted_revision) >= item.draftRevision) throw new Error('이미 전송한 초안입니다.');
      const active = (await tx.execute("SELECT id FROM messages WHERE conversation_id=? AND status IN ('pending','generating')", [item.conversationId])).rows[0];
      if (active) throw new Error('진행 중인 응답을 먼저 마치거나 중단해 주세요.');
      const sequence = Number((await tx.execute('SELECT COALESCE(MAX(sequence),0) AS value FROM messages WHERE conversation_id=?', [item.conversationId])).rows[0]?.value) + 1;
      const user: Message = {id: newId('msg'), conversationId: item.conversationId, sequence, role: 'user', content: item.text.trim(), status: 'completed', requestId: item.id, error: null, createdAt: Date.now()};
      const assistant: Message | undefined = item.generate ? {...user, id: newId('msg'), sequence: sequence + 1, role: 'assistant', content: '', status: 'pending'} : undefined;
      for (const message of assistant ? [user, assistant] : [user]) {
        await tx.execute('INSERT INTO messages(id,conversation_id,sequence,role,content,status,request_id,error,created_at) VALUES(?,?,?,?,?,?,?,?,?)', [message.id, message.conversationId, message.sequence, message.role, message.content, message.status, message.requestId, message.error, message.createdAt]);
      }
      await tx.execute('INSERT INTO chat_submissions(id,conversation_id,text,draft_revision,generate,user_message_id,assistant_message_id) VALUES(?,?,?,?,?,?,?)', [item.id, item.conversationId, item.text, item.draftRevision, Number(item.generate), user.id, assistant?.id ?? null]);
      // Preserve a newer edit, but keep a tombstone for the accepted version even when empty.
      await tx.execute(`INSERT INTO composer_drafts(conversation_id,text,revision,accepted_revision) VALUES(?,'',?,?)
        ON CONFLICT(conversation_id) DO UPDATE SET
        text=CASE WHEN composer_drafts.revision<=excluded.revision THEN '' ELSE composer_drafts.text END,
        revision=MAX(composer_drafts.revision,excluded.revision),accepted_revision=excluded.accepted_revision`, [item.conversationId, item.draftRevision, item.draftRevision]);
      await tx.execute("UPDATE conversations SET updated_at=?,title=CASE WHEN title_edited=0 AND title='새로운 대화' THEN ? ELSE title END WHERE id=?", [user.createdAt, user.content.slice(0, 40), item.conversationId]);
      return {user, assistant, replayed: false};
    });
  }
  private async message(id: string, tx: SqlSession) {return messageSchema.parse((await tx.execute(`SELECT ${messageColumns} FROM messages WHERE id=?`, [id])).rows[0]);}
}
