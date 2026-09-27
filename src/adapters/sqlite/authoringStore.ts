import type {SqlDatabase} from '../../ports/storage';
import {cardSchema, newCard, newId} from '../../features/cards/model';
import {assetReferences} from '../../features/cards/experience';
import {assetSchema} from '../../features/authoring/assets';
import {parseCardBundle} from '../../features/authoring/cardBundle';
import {newProject, projectSchema, studioCardSchema, type AuthoringProject} from '../../features/authoring/model';
import type {AuthoringStore, CardAsset, StoredProject} from '../../features/authoring/store';

const conflict = () => new Error('다른 편집에서 변경된 내용이 있어요. 현재 초안을 보관한 뒤 다시 열어 주세요.');

/** One draft document owns content, creation chat and change receipts atomically. */
export class SqliteAuthoringStore implements AuthoringStore {
  constructor(private readonly db: SqlDatabase) {}
  async open(cardId: string): Promise<StoredProject> {
    return this.db.transaction(async tx => {
      const row = (await tx.execute('SELECT document,revision FROM authoring_projects WHERE card_id=?', [cardId])).rows[0];
      if (row) return {project: projectSchema.parse(JSON.parse(String(row.document))), storageRevision: Number(row.revision)};
      const saved = (await tx.execute('SELECT document FROM cards WHERE id=?', [cardId])).rows[0];
      if (!saved) throw new Error('카드를 찾을 수 없어요.');
      const card = cardSchema.parse(JSON.parse(String(saved.document)));
      if (card.body.kind !== 'template') throw new Error('코드 카드는 기존 편집기를 이용해 주세요.');
      const buffered = (await tx.execute('SELECT document,base_revision FROM editor_buffers WHERE card_id=?', [cardId])).rows[0];
      if (buffered && Number(buffered.base_revision) !== card.revision) throw conflict();
      const draft = buffered ? studioCardSchema.parse(JSON.parse(String(buffered.document))) : card;
      const project = newProject(draft, card.revision);
      await tx.execute('INSERT INTO authoring_projects(card_id,revision,document) VALUES(?,0,?)', [cardId, JSON.stringify(project)]);
      // Ownership transfers only after both the source and destination validate.
      await tx.execute('DELETE FROM editor_buffers WHERE card_id=?', [cardId]);
      return {project, storageRevision: 0};
    });
  }
  async save(input: AuthoringProject, expected: number) {
    const project = projectSchema.parse(input);
    if (project.draft.id !== project.cardId) throw new Error('편집 대상이 일치하지 않아요.');
    const result = await this.db.execute('UPDATE authoring_projects SET document=?,revision=revision+1 WHERE card_id=? AND revision=?', [JSON.stringify(project), project.cardId, expected]);
    if (result.changes !== 1) throw conflict();
    return expected + 1;
  }
  async publish(input: AuthoringProject, expected: number) {
    const project = projectSchema.parse(input);
    const title = project.draft.title.trim();
    if (!title) throw new Error('카드 제목을 입력해 주세요.');
    if (project.draft.body.kind !== 'template') throw new Error('지원하지 않는 제작 형식이에요.');
    return this.db.transaction(async tx => {
      const row = (await tx.execute('SELECT document,revision FROM cards WHERE id=?', [project.cardId])).rows[0];
      if (!row || Number(row.revision) !== project.baseCardRevision) throw conflict();
      for (const id of assetReferences(project.draft)) if (!(await tx.execute('SELECT id FROM card_assets WHERE id=?', [id])).rows.length) throw new Error('연결한 에셋을 찾을 수 없어요. 다시 선택해 주세요.');
      const current = cardSchema.parse(JSON.parse(String(row.document)));
      const card = cardSchema.parse({...project.draft, title, studioDraft: false, publishedVersion: newId('card_version'), revision: current.revision + 1, updatedAt: Date.now(), favorite: current.favorite, archived: current.archived, pinnedAt: current.pinnedAt});
      const next = {...project, draft: card, baseCardRevision: card.revision, publishedDraftRevision: project.revision};
      const stored = await tx.execute('UPDATE authoring_projects SET document=?,revision=revision+1 WHERE card_id=? AND revision=?', [JSON.stringify(next), card.id, expected]);
      if (stored.changes !== 1) throw conflict();
      await tx.execute('INSERT INTO card_versions(id,card_id,document,created_at) VALUES(?,?,?,?)', [card.publishedVersion!, card.id, JSON.stringify(card), card.updatedAt]);
      await tx.execute('UPDATE cards SET title=?,revision=?,updated_at=?,document=? WHERE id=?', [card.title, card.revision, card.updatedAt, JSON.stringify(card), card.id]);
      return {project: next, storageRevision: expected + 1, card};
    });
  }
  async putAsset(input: Omit<CardAsset, 'id'>) {
    const asset = assetSchema.parse({id: newId('asset'), ...input});
    await this.db.execute('INSERT INTO card_assets(id,uri,width,height,name) VALUES(?,?,?,?,?)', [asset.id, asset.uri, asset.width, asset.height, asset.name ?? null]);
    return asset;
  }
  async getAsset(id: string) {
    const row = (await this.db.execute('SELECT id,uri,width,height,name FROM card_assets WHERE id=?', [id])).rows[0];
    return row ? assetSchema.parse({...row, name: row.name ?? undefined}) : null;
  }
  async importBundle(text: string) {
    const bundle = parseCardBundle(text);
    return this.db.transaction(async tx => {
      const remap = new Map(bundle.assets.map(a => [a.id, newId('asset')]));
      for (const asset of bundle.assets) await tx.execute('INSERT INTO card_assets(id,uri,width,height,name) VALUES(?,?,?,?,?)', [remap.get(asset.id)!, asset.uri, asset.width, asset.height, asset.name ?? null]);
      const card = cardSchema.parse({...newCard(), ...bundle.card, publishedVersion: newId('card_version'), studioDraft: false,
        coverAssetId: bundle.card.coverAssetId ? remap.get(bundle.card.coverAssetId) : undefined,
        experience: bundle.card.experience ? {...bundle.card.experience, resources: bundle.card.experience.resources.map(r => ({...r, assetIds: r.assetIds.map(id => remap.get(id)!)}))} : undefined});
      await tx.execute('INSERT INTO cards(id,title,kind,revision,updated_at,favorite,archived,document) VALUES(?,?,?,0,?,0,0,?)', [card.id, card.title, card.body.kind, card.updatedAt, JSON.stringify(card)]);
      await tx.execute('INSERT INTO card_versions(id,card_id,document,created_at) VALUES(?,?,?,?)', [card.publishedVersion!, card.id, JSON.stringify(card), card.updatedAt]);
      const project = {...newProject(card), view: 'edit' as const, publishedDraftRevision: 0};
      await tx.execute('INSERT INTO authoring_projects(card_id,revision,document) VALUES(?,0,?)', [card.id, JSON.stringify(project)]);
      return card;
    });
  }
}
