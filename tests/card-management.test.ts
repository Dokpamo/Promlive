import {afterEach, expect, it, vi} from 'vitest';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {repository, FixtureProvider} from './helpers';
import {newCard, type Draft} from '../src/features/cards/model';
import {Workspace} from '../src/app/workspace';
import {CreationService} from '../src/features/chat/service';
import {GenerationCoordinator} from '../src/features/chat/generation';
import type {SqlDatabase} from '../src/ports/storage';
const opened: SqlDatabase[] = [];
afterEach(async () => {vi.restoreAllMocks(); for (const db of opened.splice(0)) await db.close();});
async function setup(provider = new FixtureProvider()) {
  const repo = await repository(); opened.push(repo.db);
  const creation = new CreationService(repo, new GenerationCoordinator(provider));
  const workspace = new Workspace({repo, provider, creation});
  return {repo, creation, workspace};
}
function gate() {let resolve!: () => void; const promise = new Promise<void>(done => {resolve = done;}); return {promise, resolve};}

it('persists card names and pins, keeps favorites independent, and restores original order on unpin', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'promlive-cards-'));
  const path = join(dir, 'test.sqlite');
  let repo = await repository(path);
  try {
    const older = await repo.insertCard({...newCard(), title: '이전 카드', updatedAt: 100});
    const newer = await repo.insertCard({...newCard(), title: '최근 카드', updatedAt: 200});
    expect((await repo.listCards()).map(card => card.id)).toEqual([newer.id, older.id]);
    await repo.updateMetadata(older.id, {pinnedAt: 300, title: '  고정한 카드  '});
    await repo.db.close(); repo = await repository(path);
    expect((await repo.listCards()).map(card => card.id)).toEqual([older.id, newer.id]);
    expect(await repo.getCard(older.id)).toMatchObject({title: '고정한 카드', pinnedAt: 300, favorite: false, updatedAt: 100});
    await repo.updateMetadata(older.id, {pinnedAt: null});
    expect((await repo.listCards()).map(card => card.id)).toEqual([newer.id, older.id]);
    await expect(repo.updateMetadata(older.id, {title: '  '})).rejects.toThrow();
    expect((await repo.getCard(older.id)).title).toBe('고정한 카드');
  } finally {await repo.db.close(); rmSync(dir, {recursive: true, force: true});}
});

it('renames without losing buffered body edits, and pinning does not overwrite an edited title', async () => {
  const {repo, workspace} = await setup();
  const card = await repo.insertCard(newCard());
  await workspace.ready(); await workspace.open(card.id);
  workspace.cardEditor.editWorld('world', '저장 전 세계관');
  workspace.cardEditor.edit({title: '입력 중 제목'});
  await workspace.cardActions.pin(card.id, true);
  expect(workspace.cardEditor.state?.card.title).toBe('입력 중 제목');
  await workspace.cardActions.rename(card.id, '  목록에서 바꾼 제목  ');
  const buffer = await repo.getBuffer(card.id);
  expect(buffer?.card.title).toBe('목록에서 바꾼 제목');
  expect(buffer?.card.body).toMatchObject({data: {world: '저장 전 세계관'}});
  expect(buffer?.baseRevision).toBe((await repo.getCard(card.id)).revision);
  await workspace.cardEditor.save();
  expect(await repo.getCard(card.id)).toMatchObject({title: '목록에서 바꾼 제목', body: {data: {world: '저장 전 세계관'}}});
});

it('deletes only selected cards and their chats, messages, input drafts and editor buffers', async () => {
  const {repo, workspace} = await setup();
  const cards = await Promise.all(['첫 번째', '두 번째', '유지'].map(title => repo.insertCard({...newCard(), title})));
  const rooms = [];
  for (const card of cards) {
    const room = await repo.createConversation(card.id); rooms.push(room);
    await repo.appendLocalUserMessage(room.id, card.title);
    await repo.writeComposerDraft(room.id, {text: '작성 중', revision: 1});
    await repo.saveBuffer({...card, description: '수정 중'}, card.revision);
    await repo.putDraft({id: `draft-${card.id}`, cardId: card.id, baseRevision: 0, kind: 'writing', status: 'completed', instruction: '지시', content: '초안', sources: [], error: null, createdAt: 1});
  }
  await workspace.ready(); await workspace.openConversation(rooms[0]!);
  await workspace.cardActions.remove([cards[0]!.id, cards[1]!.id, cards[0]!.id]);
  expect(workspace.cards.map(card => card.id)).toEqual([cards[2]!.id]);
  expect(workspace.history.selected?.id).toBe(rooms[2]!.id);
  for (const index of [0, 1]) {
    expect(await repo.messages(rooms[index]!.id)).toEqual([]);
    expect(await repo.drafts(cards[index]!.id)).toEqual([]);
    expect(await repo.getBuffer(cards[index]!.id)).toBeNull();
    await repo.writeComposerDraft(rooms[index]!.id, {text: '늦게 도착한 입력', revision: 2});
    expect((await repo.loadComposerDraft(rooms[index]!.id)).text).toBe('');
  }
  expect(await repo.messages(rooms[2]!.id)).toHaveLength(1);
  expect((await repo.loadComposerDraft(rooms[2]!.id)).text).toBe('작성 중');
  expect(await repo.getBuffer(cards[2]!.id)).not.toBeNull();
});

it('rolls back the entire card deletion if a later card cannot be deleted', async () => {
  const {repo, workspace} = await setup();
  const first = await repo.insertCard(newCard());
  const keep = await repo.insertCard({...newCard(), id: 'cannot-delete'});
  await repo.createConversation(first.id);
  await repo.db.execute("CREATE TRIGGER prevent_delete BEFORE DELETE ON cards WHEN OLD.id='cannot-delete' BEGIN SELECT RAISE(ABORT, 'blocked'); END");
  await workspace.ready();
  await expect(workspace.cardActions.remove([first.id, keep.id])).rejects.toThrow('blocked');
  expect(workspace.cards).toHaveLength(2);
  expect(await repo.listCards()).toHaveLength(2);
  expect(await repo.conversations()).toHaveLength(1);
});

it('cancels both a streaming reply and a card draft before cascading storage', async () => {
  const started = gate(); let running = 0;
  const provider = new FixtureProvider(async function* () {
    yield {type: 'delta', text: '부분 생성'};
    if (++running === 2) started.resolve();
    await new Promise(() => {});
  });
  const {repo, creation, workspace} = await setup(provider);
  const card = await repo.insertCard(newCard());
  const room = await repo.createConversation(card.id);
  await workspace.ready();
  const send = creation.send(card, room.id, '대화');
  const draft = creation.generateDraft(card, '초안', 'writing');
  await started.promise;
  await workspace.cardActions.remove([card.id]);
  await send;
  expect((await draft).status).toBe('cancelled');
  expect(creation.live(room.id)).toBeUndefined();
  expect(creation.draft(card.id)).toBeUndefined();
  expect(creation.lastError()).toBeNull();
  expect(await repo.messages(room.id)).toEqual([]);
  expect(await repo.drafts(card.id)).toEqual([]);
});

it('blocks new generation while deletion drains an initial draft write', async () => {
  const {repo, creation, workspace} = await setup();
  const card = await repo.insertCard(newCard());
  const room = await repo.createConversation(card.id);
  await workspace.ready();
  const writing = gate(), release = gate();
  const put = repo.putDraft.bind(repo);
  vi.spyOn(repo, 'putDraft').mockImplementationOnce(async (draft: Draft) => {writing.resolve(); await release.promise; await put(draft);});
  const draft = creation.generateDraft(card, '초안', 'writing');
  await writing.promise;
  const enumerating = gate();
  const list = repo.conversations.bind(repo);
  vi.spyOn(repo, 'conversations').mockImplementationOnce(async () => {enumerating.resolve(); return list();});
  const deleting = workspace.cardActions.remove([card.id]);
  await enumerating.promise;
  await expect(creation.send(card, room.id, '전송')).rejects.toThrow('삭제 중');
  await expect(creation.generateDraft(card, '새 초안', 'writing')).rejects.toThrow('삭제 중');
  release.resolve(); await draft; await deleting;
  expect(await repo.drafts(card.id)).toEqual([]);
});

it('waits for a room already being created and invalidates late refresh results', async () => {
  const {repo, workspace} = await setup();
  const card = await repo.insertCard(newCard());
  await workspace.ready();
  const reading = gate(), releaseRead = gate(), creating = gate(), releaseRoom = gate();
  const old = await repo.listCards();
  vi.spyOn(repo, 'listCards').mockImplementationOnce(async () => {reading.resolve(); await releaseRead.promise; return old;});
  const refresh = workspace.refresh(); await reading.promise;
  const create = repo.createConversation.bind(repo);
  vi.spyOn(repo, 'createConversation').mockImplementationOnce(async id => {creating.resolve(); await releaseRoom.promise; return create(id);});
  const opening = workspace.startChat(card, true); await creating.promise;
  const deleting = workspace.cardActions.remove([card.id]);
  releaseRoom.resolve(); await opening; await deleting;
  releaseRead.resolve(); await refresh;
  expect(workspace.cards).toEqual([]);
  expect(workspace.history.selected).toBeNull();
  expect(await repo.conversations()).toEqual([]);
});

it('drains a queued editor buffer and can recreate general chat after deleting its card', async () => {
  const {repo, workspace} = await setup();
  await workspace.readyChat();
  const card = workspace.cards.find(item => item.id === 'promlive-general-chat')!;
  await workspace.open(card.id);
  workspace.cardEditor.edit({description: '작성 중인 소개'});
  const writing = gate(), release = gate();
  const save = repo.saveBuffer.bind(repo);
  vi.spyOn(repo, 'saveBuffer').mockImplementationOnce(async (...args) => {writing.resolve(); await release.promise; return save(...args);});
  const flush = workspace.cardEditor.flush(); await writing.promise;
  const deleting = workspace.cardActions.remove([card.id]);
  release.resolve(); await flush; await deleting;
  expect(workspace.cardEditor.state).toBeNull();
  expect(await repo.getBuffer(card.id)).toBeNull();
  await workspace.newGeneralChat();
  expect(workspace.history.selected?.cardId).toBe('promlive-general-chat');
  expect(await repo.conversations()).toHaveLength(1);
  expect(await repo.listCards()).toHaveLength(1);
});
