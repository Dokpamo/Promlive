import {afterEach, describe, expect, it} from 'vitest';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrate, migrations} from '../src/adapters/sqlite/migrations';
import {Repository, RevisionConflict} from '../src/adapters/sqlite/repository';
import {newCard, type Draft} from '../src/features/cards/model';
import {nodeDatabase, repository} from './helpers';
import {SerialDatabase, type SqlDatabase} from '../src/ports/storage';
const opened: SqlDatabase[] = [];
afterEach(async () => {for (const db of opened.splice(0)) await db.close();});
async function repo() {const r = await repository(); opened.push(r.db); return r;}
describe('SQLite persistence and migration', () => {
  it('saves quotes and SQL-looking text as values', async () => {
    const r = await repo(); const card = newCard(); card.title = "O'Reilly'); DROP TABLE cards;--";
    await r.insertCard(card); expect((await r.listCards())[0]?.title).toBe(card.title);
    await r.insertCard(newCard()); expect(await r.listCards()).toHaveLength(2);
  });
  it('reopens cards, editor buffers and separate conversations from a real SQLite file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'storyloom-test-')); const path = join(dir, 'app.sqlite');
    try {
      const first = await repository(path); const card = await first.insertCard(newCard());
      await first.saveBuffer({...card, description: '아직 저장하지 않은 문장'}, 0);
      const chat = await first.createConversation(card.id); const exchange = await first.beginExchange(chat.id, 'persist', '안녕');
      await first.saveMessage({...exchange.assistant, status: 'generating', content: '부분 응답'});
      await first.db.close();
      const second = await repository(path);
      await second.recoverInterrupted();
      expect((await second.getCard(card.id)).description).toBe('');
      expect((await second.getBuffer(card.id))?.card.description).toBe('아직 저장하지 않은 문장');
      expect((await second.messages(chat.id))[1]).toMatchObject({content: '부분 응답', status: 'interrupted'});
      await second.db.close();
    } finally {rmSync(dir, {recursive: true, force: true});}
  });
  it('upgrades schema without losing v1 data', async () => {
    const db = nodeDatabase(); opened.push(db); await migrate(db, [migrations[0]]);
    const r = new Repository(db); const card = await r.insertCard(newCard());
    await migrate(db); expect((await r.getCard(card.id)).title).toBe(card.title);
    await r.saveBuffer({...card, description: 'v2'}, 0); expect((await r.getBuffer(card.id))?.card.description).toBe('v2');
  });
  it('rolls back failed migrations, preserving schema version and original rows', async () => {
    const db = nodeDatabase(); opened.push(db); await migrate(db, [migrations[0]]);
    const r = new Repository(db); const card = await r.insertCard(newCard());
    await expect(migrate(db, [migrations[0], ['ALTER TABLE cards ADD COLUMN temporary TEXT', 'THIS IS NOT VALID SQL']])).rejects.toThrow();
    expect((await db.execute('PRAGMA user_version')).rows[0]?.user_version).toBe(1);
    expect((await db.execute('PRAGMA table_info(cards)')).rows.some(row => row.name === 'temporary')).toBe(false);
    expect((await r.getCard(card.id)).id).toBe(card.id);
  });
  it('serializes transactions so failed work cannot roll back an unrelated write', async () => {
    const r = await repo();
    const bad = r.db.transaction(async tx => {await tx.execute('INSERT INTO settings(key,value) VALUES(?,?)', ['bad', 'bad']); await Promise.resolve(); throw new Error('abort');});
    const good = r.setSetting('good', 'kept');
    await expect(bad).rejects.toThrow('abort'); await good;
    expect(await r.getSetting('bad')).toBeUndefined(); expect(await r.getSetting('good')).toBe('kept');
  });
  it('does not accept more writes after an external persistence failure', async () => {
    const db = new SerialDatabase({execute: async () => ({rows: [], changes: 1}), persist: async () => {throw new Error('disk full');}, close: async () => {}});
    await expect(db.execute('INSERT')).rejects.toThrow('저장');
    await expect(db.execute('SELECT')).rejects.toThrow('저장'); await db.close();
  });
});
describe('card revisions and drafts', () => {
  const draftFor = (cardId: string): Draft => ({id: 'draft1', cardId, baseRevision: 0, kind: 'writing', status: 'completed', instruction: 'test', content: 'new text', sources: [], error: null, createdAt: Date.now()});
  it('rejects stale editor writes', async () => {
    const r = await repo(); const card = await r.insertCard(newCard());
    await r.saveCard({...card, title: '최신 제목'}, 0);
    await expect(r.saveCard({...card, title: '오래된 제목'}, 0)).rejects.toBeInstanceOf(RevisionConflict);
    expect((await r.getCard(card.id)).title).toBe('최신 제목');
  });
  it('applies a reviewed draft and revision atomically', async () => {
    const r = await repo(); const card = await r.insertCard(newCard()); const draft = draftFor(card.id); await r.putDraft(draft);
    const saved = await r.applyDraft(draft, {...card, description: '검토한 초안'});
    expect(saved.revision).toBe(1); expect((await r.drafts(card.id))[0]?.status).toBe('applied');
  });
  it('protects unsaved edits and rejects partial or stale drafts', async () => {
    const r = await repo(); const card = await r.insertCard(newCard()); const draft = draftFor(card.id);
    await r.saveBuffer({...card, description: '사용자 편집'}, 0);
    await expect(r.applyDraft(draft, card)).rejects.toBeInstanceOf(RevisionConflict);
    await r.saveCard({...card, description: '저장된 사용자 편집'}, 0);
    await expect(r.applyDraft(draft, card)).rejects.toBeInstanceOf(RevisionConflict);
    await expect(r.applyDraft({...draft, status: 'cancelled'}, card)).rejects.toThrow('완료');
    expect((await r.getCard(card.id)).description).toBe('저장된 사용자 편집');
  });
  it('validates stored documents at the boundary', async () => {
    const r = await repo(); const card = await r.insertCard(newCard());
    await r.db.execute('UPDATE cards SET document=? WHERE id=?', ['{"formatVersion":999}', card.id]);
    await expect(r.getCard(card.id)).rejects.toThrow();
  });
  it('preserves unsaved text through favorite/archive changes in the same transaction', async () => {
    const r = await repo(); const card = await r.insertCard(newCard());
    await r.saveBuffer({...card, title: '', description: '지워지면 안 되는 초안'}, 0);
    await r.updateMetadata(card.id, {favorite: true, archived: true});
    const buffer = await r.getBuffer(card.id);
    expect(buffer?.baseRevision).toBe(1);
    expect(buffer?.card).toMatchObject({title: '', description: '지워지면 안 되는 초안', favorite: true, archived: true});
    expect((await r.getCard(card.id)).description).toBe('');
  });
});
