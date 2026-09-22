import {z} from 'zod';
import type {SqlDatabase, SqlSession} from '../../ports/storage';
import type {ExtensionStore, SummaryExtension, SummaryResult} from '../../extensions/store';
import {summaryExtensionId as id, summaryProgramSchema, type SummaryProgram} from '../../extensions/summaryProgram';

export class SqliteExtensionStore implements ExtensionStore {
  constructor(private readonly db: SqlDatabase) {}
  async load(tx: SqlSession = this.db): Promise<SummaryExtension> {
    const row = (await tx.execute('SELECT * FROM personal_extensions WHERE id=?', [id])).rows[0];
    const versions = (await tx.execute('SELECT version,document,created_at FROM personal_extension_versions WHERE extension_id=? ORDER BY version DESC', [id])).rows.flatMap(item => {
      try {const parsed = summaryProgramSchema.safeParse(JSON.parse(String(item.document))); return parsed.success ? [{version: Number(item.version), program: parsed.data, createdAt: Number(item.created_at)}] : [];}
      catch {return [];}
    });
    return row ? {revision: Number(row.revision), executionRevision: Number(row.execution_revision), activeVersion: row.active_version == null ? null : Number(row.active_version), draftVersion: row.draft_version == null ? null : Number(row.draft_version), enabled: Boolean(row.enabled), grants: z.array(z.string()).parse(JSON.parse(String(row.grants))), versions} : {revision: 0, executionRevision: 0, activeVersion: null, draftVersion: null, enabled: false, grants: [], versions};
  }
  private async current(tx: SqlSession, expectedRevision: number) {
    await tx.execute('INSERT OR IGNORE INTO personal_extensions(id) VALUES(?)', [id]);
    const current = await this.load(tx);
    if (current.revision !== expectedRevision) throw new Error('플러그인이 변경됐어요. 최신 내용을 확인한 뒤 다시 적용해 주세요.');
    return current;
  }
  async stage(input: SummaryProgram, expectedRevision: number) {
    const program = summaryProgramSchema.parse(input);
    return this.db.transaction(async tx => {
      await this.current(tx, expectedRevision);
      const version = Number((await tx.execute('SELECT COALESCE(MAX(version),0) AS version FROM personal_extension_versions WHERE extension_id=?', [id])).rows[0]?.version) + 1;
      await tx.execute('INSERT INTO personal_extension_versions(extension_id,version,document,created_at) VALUES(?,?,?,?)', [id, version, JSON.stringify(program), Date.now()]);
      await tx.execute('UPDATE personal_extensions SET draft_version=?,revision=revision+1 WHERE id=?', [version, id]);
      return this.load(tx);
    });
  }
  async activate(version: number, expectedRevision: number, grants: readonly string[]) {
    return this.db.transaction(async tx => {
      const current = await this.current(tx, expectedRevision);
      const candidate = current.versions.find(item => item.version === version);
      if (!candidate) throw new Error('복원할 버전을 찾지 못했어요.');
      const requested = candidate.program.requestedCapabilities;
      if (requested.some(capability => !grants.includes(capability)) || grants.some(capability => !requested.includes(capability as typeof requested[number]))) throw new Error('이 플러그인에 필요한 권한을 확인해 주세요.');
      await tx.execute('UPDATE personal_extensions SET active_version=?,draft_version=CASE WHEN draft_version=? THEN NULL ELSE draft_version END,enabled=1,grants=?,revision=revision+1,execution_revision=execution_revision+1 WHERE id=?', [version, version, JSON.stringify(grants), id]);
      return this.load(tx);
    });
  }
  async disable(expectedRevision: number) {
    return this.db.transaction(async tx => {
      await this.current(tx, expectedRevision);
      await tx.execute('UPDATE personal_extensions SET enabled=0,grants=\'[]\',revision=revision+1,execution_revision=execution_revision+1 WHERE id=?', [id]);
      return this.load(tx);
    });
  }
  async saveResult(result: SummaryResult, expectedRevision: number) {
    z.string().min(1).max(30000).parse(result.content);
    await this.db.transaction(async tx => {
      const current = await this.load(tx);
      const program = current.versions.find(version => version.version === result.version)?.program;
      if (current.executionRevision !== expectedRevision || !current.enabled || current.activeVersion !== result.version || !program || program.requestedCapabilities.some(capability => !current.grants.includes(capability))) throw new Error('실행 중 플러그인이 변경되어 결과 저장을 중단했어요.');
      await tx.execute('INSERT INTO personal_extension_results(id,extension_id,conversation_id,version,content,through_sequence,message_count,created_at) VALUES(?,?,?,?,?,?,?,?)', [result.id, id, result.conversationId, result.version, result.content, result.throughSequence, result.messageCount, result.createdAt]);
    });
  }
  async results(conversationId: string): Promise<SummaryResult[]> {
    return (await this.db.execute('SELECT id,conversation_id AS conversationId,version,content,through_sequence AS throughSequence,message_count AS messageCount,created_at AS createdAt FROM personal_extension_results WHERE extension_id=? AND conversation_id=? ORDER BY created_at DESC,id DESC LIMIT 10', [id, conversationId])).rows.map(row => ({id: String(row.id), conversationId: String(row.conversationId), version: Number(row.version), content: String(row.content), throughSequence: Number(row.throughSequence), messageCount: Number(row.messageCount), createdAt: Number(row.createdAt)}));
  }
}
