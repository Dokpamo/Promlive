import {afterEach, expect, it, vi} from 'vitest';
import {mkdtempSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {repository, FixtureProvider, nodeDatabase} from './helpers';
import {SqliteAuthoringStore} from '../src/adapters/sqlite/authoringStore';
import {Repository} from '../src/adapters/sqlite/repository';
import {migrate, migrations} from '../src/adapters/sqlite/migrations';
import {AuthoringSession} from '../src/features/authoring/AuthoringSession';
import {AuthoringAssistant} from '../src/features/authoring/AuthoringAssistant';
import {StudioPreview} from '../src/features/authoring/StudioPreview';
import {fieldValue, type FieldChange} from '../src/features/authoring/model';
import {newCard} from '../src/features/cards/model';
import {GenerationCoordinator} from '../src/features/chat/generation';
import {CreationService} from '../src/features/chat/service';
import type {SqlDatabase} from '../src/ports/storage';
import type {AiEvent, AiRequest} from '../src/ports/ai';

const databases: SqlDatabase[] = [], sessions: AuthoringSession[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const session of sessions.splice(0)) await session.close().catch(() => {});
  for (const db of databases.splice(0)) await db.close();
});
const reply = (changes: FieldChange[]) => JSON.stringify({kind: 'change', message: 'AI가 저장했다고 주장해도 호스트가 결정합니다.', changes});
function response(text: string, before?: () => Promise<void>) {
  return new FixtureProvider(async function* () {await before?.(); yield {type: 'delta', text}; yield {type: 'done'};});
}
async function setup(provider = response(reply([{field: 'tone', value: '짧고 다정하게 말한다.'}]))) {
  const repo = await repository(); databases.push(repo.db);
  const card = await repo.insertCard({...newCard(), studioDraft: true});
  const store = new SqliteAuthoringStore(repo.db), coordinator = new GenerationCoordinator(provider);
  const session = new AuthoringSession(card.id, store, new AuthoringAssistant(coordinator)); sessions.push(session);
  await session.load();
  return {repo, card, store, session, provider, coordinator};
}

it('round-trips AI creation, direct editing and targeted AI editing through one persisted draft', async () => {
  const provider = response(reply([{field: 'title', value: '밤의 사서'}, {field: 'characterName', value: '서린'}, {field: 'tone', value: '존댓말'}]));
  const {session, store, repo, card} = await setup(provider);
  const calls = vi.spyOn(provider, 'stream');
  session.setPrompt('밤의 도서관 사서를 만들어 줘'); await session.generate();
  session.setField('characterName', '하린'); session.setTarget('tone');
  provider.stream = vi.fn(async function* (): AsyncIterable<AiEvent> {yield {type: 'delta', text: reply([{field: 'tone', value: '하린은 짧고 다정하게 말한다.'}])}; yield {type: 'done'};});
  session.setPrompt('말투만 다정하게'); await session.generate();
  const p = (await store.open(card.id)).project;
  expect(fieldValue(p.draft, 'characterName')).toBe('하린');
  expect(fieldValue(p.draft, 'tone')).toContain('하린');
  expect(provider.stream).toHaveBeenCalledTimes(1);
  const sent = vi.mocked(provider.stream).mock.calls[0]![0];
  expect(sent.context).toContain('하린'); expect(sent.outputSchema).toBeTruthy();
  expect(calls).toHaveBeenCalledTimes(1);
  expect((await repo.getCard(card.id)).title).toBe('제목 없는 이야기');
  expect(p.messages.at(-1)?.status).toBe('applied'); expect(p.changes).toHaveLength(2);
});

it('merges an independent field change but rejects changed read dependencies and active inputs', async () => {
  let finish!: () => void;
  let gate = new Promise<void>(resolve => {finish = resolve;});
  const {session, provider} = await setup(response(reply([{field: 'tone', value: '따뜻한 말투'}]), () => gate));
  session.setTarget('tone');
  let task = session.generate('바꿔 줘');
  await vi.waitFor(() => expect(provider.calls).toBe(1));
  session.setField('world', '직접 수정한 세계'); finish(); await task;
  expect(fieldValue(session.snapshot().project!.draft, 'world')).toBe('직접 수정한 세계');
  expect(session.snapshot().project!.messages.at(-1)?.status).toBe('applied');

  gate = new Promise<void>(resolve => {finish = resolve;});
  task = session.generate('더 바꿔 줘'); await vi.waitFor(() => expect(provider.calls).toBe(2));
  session.setField('characterName', '다른 이름'); finish(); await task;
  expect(session.snapshot().project!.messages.at(-1)?.status).toBe('conflict');

  session.setFocusedField('tone');
  await session.generate('다시 바꿔 줘');
  expect(session.snapshot().project!.messages.at(-1)?.status).toBe('conflict');
  session.setFocusedField(null);
});

it.each([
  '{not json',
  JSON.stringify({kind: 'change', message: '', changes: [{field: 'apiKey', value: 'secret'}]}),
  JSON.stringify({kind: 'change', message: '', changes: [{field: 'tone', value: 'one'}, {field: 'tone', value: 'two'}]}),
  JSON.stringify({kind: 'reply', message: '', changes: [{field: 'tone', value: 'hidden edit'}]}),
  reply([{field: 'title', value: 'x'.repeat(121)}]),
  reply([{field: 'world', value: '선택 범위 밖'}]),
])('rejects malformed or unauthorized changes without modifying content: %s', async output => {
  const {session} = await setup(response(output)); session.setTarget('tone');
  const before = session.snapshot().project!.draft;
  await session.generate('수정');
  expect(session.snapshot().project!.draft).toEqual(before);
  expect(session.snapshot().project!.changes).toHaveLength(0);
  expect(session.snapshot().project!.messages.at(-1)?.status).toBe('failed');
});

it('cancels paid generation, ignores late output, and persists cancellation across reopen', async () => {
  let finish!: () => void;
  const gate = new Promise<void>(resolve => {finish = resolve;});
  const {session, store, provider, card} = await setup(response(reply([{field: 'title', value: 'late'}]), () => gate));
  const task = session.generate('만들어 줘'); await vi.waitFor(() => expect(provider.calls).toBe(1));
  session.cancel(); finish(); await task; await session.flush();
  expect(provider.signal?.aborted).toBe(true);
  const p = (await store.open(card.id)).project;
  expect(p.draft.title).toBe('제목 없는 이야기'); expect(p.messages.at(-1)?.status).toBe('cancelled');
});

it('undoes one AI operation while preserving unrelated edits, and protects subsequent related edits', async () => {
  const {session} = await setup(); await session.generate('말투 수정');
  const id = session.snapshot().project!.changes[0]!.id;
  session.setField('world', '새 세계'); await session.undo(id);
  expect(fieldValue(session.snapshot().project!.draft, 'tone')).toBe('');
  expect(fieldValue(session.snapshot().project!.draft, 'world')).toBe('새 세계');
  await session.generate('말투 수정'); const nextId = session.snapshot().project!.changes[1]!.id;
  session.setField('tone', '직접 작성한 말투'); await session.undo(nextId);
  expect(fieldValue(session.snapshot().project!.draft, 'tone')).toBe('직접 작성한 말투');
  expect(session.snapshot().error).toContain('되돌리지');
});

it('retains applied content and receipt together on storage failure, and retries without another AI call', async () => {
  const {session, store, provider, card} = await setup();
  const save = store.save.bind(store);
  const failing = vi.spyOn(store, 'save').mockImplementation((project, expected) => {
    if (project.changes.length) return Promise.reject(new Error('disk full'));
    return save(project, expected);
  });
  await session.generate('말투 수정');
  expect(session.snapshot().saving).toBe(true); expect(session.snapshot().error).toContain('저장');
  expect(session.snapshot().project!.messages.at(-1)?.status).toBe('applied');
  expect((await store.open(card.id)).project.changes).toHaveLength(0);
  failing.mockRestore(); await session.flush();
  expect((await store.open(card.id)).project.changes).toHaveLength(1);
  expect(provider.calls).toBe(1);
});

it('keeps blank drafts and recovers draft, view, prompt, asset and interrupted creation after restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'promlive-authoring-')), path = join(dir, 'studio.sqlite');
  let repo = await repository(path);
  try {
    const card = await repo.insertCard({...newCard(), studioDraft: true});
    let store = new SqliteAuthoringStore(repo.db); let opened = await store.open(card.id);
    const image = await store.putAsset({uri: 'data:image/png;base64,aGVsbG8=', width: 1, height: 1});
    const p = {...opened.project, draft: {...opened.project.draft, title: '', coverAssetId: image.id}, view: 'edit' as const, prompt: '다음에 마저 만들기', messages: [{id: 'in-flight', role: 'assistant' as const, text: '', status: 'generating' as const, createdAt: 1}]};
    opened.storageRevision = await store.save(p, opened.storageRevision);
    await expect(store.publish(p, opened.storageRevision)).rejects.toThrow('제목');
    await repo.db.close(); repo = await repository(path); store = new SqliteAuthoringStore(repo.db);
    const session = new AuthoringSession(card.id, store, new AuthoringAssistant(new GenerationCoordinator(new FixtureProvider())));
    await session.load();
    expect(session.snapshot().project).toMatchObject({view: 'edit', prompt: '다음에 마저 만들기', draft: {title: '', coverAssetId: image.id}});
    expect(session.snapshot().project!.messages[0]?.status).toBe('interrupted');
    expect(await store.getAsset(image.id)).toEqual(image);
    expect(JSON.stringify(session.snapshot().project)).not.toContain('data:image');
    await session.close();
  } finally {await repo.db.close(); rmSync(dir, {recursive: true, force: true});}
});

it('adopts an unsaved legacy buffer atomically and refuses an incompatible buffer without deleting it', async () => {
  const repo = await repository(); databases.push(repo.db); const card = await repo.insertCard(newCard());
  await repo.saveBuffer({...card, title: ''}, card.revision);
  const store = new SqliteAuthoringStore(repo.db);
  expect((await store.open(card.id)).project.draft.title).toBe(''); expect(await repo.getBuffer(card.id)).toBeNull();
  const other = await repo.insertCard(newCard());
  await repo.saveBuffer({...other, title: '보존할 내용'}, 99);
  await expect(store.open(other.id)).rejects.toThrow('다른 편집');
  expect((await repo.getBuffer(other.id))?.card.title).toBe('보존할 내용');
});

it('rejects stale draft writers and rolls back every publishing write on failure', async () => {
  const {store, repo, card} = await setup();
  const first = await store.open(card.id), stale = await store.open(card.id);
  first.project.draft.title = '새 제목'; const revision = await store.save(first.project, first.storageRevision);
  await expect(store.save(stale.project, stale.storageRevision)).rejects.toThrow('다른 편집');
  await repo.db.execute("CREATE TRIGGER fail_publish BEFORE INSERT ON card_versions BEGIN SELECT RAISE(ABORT, 'fail publish'); END");
  await expect(store.publish(first.project, revision)).rejects.toThrow('fail publish');
  expect((await store.open(card.id)).storageRevision).toBe(revision);
  expect((await repo.getCard(card.id)).studioDraft).toBe(true);
  expect((await repo.db.execute('SELECT * FROM card_versions')).rows).toHaveLength(0);
});

it('pins published versions to rooms until explicitly changed, preserving messages and another card', async () => {
  const {repo, session, card} = await setup();
  await expect(repo.createConversation(card.id)).rejects.toThrow('카드로 사용');
  session.setField('greeting', '어서 오세요.'); session.setField('tone', '첫 번째 말투');
  const first = await session.publish(), room = await repo.createConversation(card.id);
  expect((await repo.messages(room.id))[0]?.content).toBe('어서 오세요.');
  session.setField('tone', '새로운 말투'); const second = await session.publish();
  expect((await repo.getConversationCard(room.id))?.publishedVersion).toBe(first.publishedVersion);
  const newer = await repo.createConversation(card.id);
  expect((await repo.getConversationCard(newer.id))?.publishedVersion).toBe(second.publishedVersion);
  const messages = await repo.messages(room.id);
  await repo.useCardVersion(room.id, second.publishedVersion!);
  expect((await repo.getConversationCard(room.id))?.publishedVersion).toBe(second.publishedVersion);
  expect(await repo.messages(room.id)).toEqual(messages);
  const other = await repo.insertCard(newCard()), otherRoom = await repo.createConversation(other.id);
  await expect(repo.useCardVersion(otherRoom.id, first.publishedVersion!)).rejects.toThrow('이 카드');
  const version = (await repo.db.execute('SELECT document FROM card_versions WHERE id=?', [first.publishedVersion!])).rows[0];
  expect(fieldValue(JSON.parse(String(version?.document)), 'tone')).toBe('첫 번째 말투');
});

it('keeps draft labels discoverable and versions a published title rename without overwriting a working title', async () => {
  const {session, repo, card, store} = await setup();
  session.setField('title', '진행 중인 초안'); await session.flush();
  expect((await repo.listCards())[0]?.title).toBe('진행 중인 초안');
  const published = await session.publish(); await session.close();
  const renamed = await repo.updateMetadata(card.id, {title: '목록에서 바꾼 이름'});
  expect(renamed.publishedVersion).not.toBe(published.publishedVersion);
  const snapshot = (await repo.db.execute('SELECT document FROM card_versions WHERE id=?', [renamed.publishedVersion!])).rows[0];
  expect(JSON.parse(String(snapshot?.document)).title).toBe('목록에서 바꾼 이름');
  const opened = await store.open(card.id);
  expect(opened.project.draft.title).toBe('목록에서 바꾼 이름');
  expect(opened.project.publishedDraftRevision).toBe(opened.project.revision);
  opened.project.draft.title = '아직 확정하지 않은 제목';
  await store.save(opened.project, opened.storageRevision);
  await repo.updateMetadata(card.id, {title: '다시 바꾼 이름', pinnedAt: 10});
  expect((await store.open(card.id)).project.draft.title).toBe('아직 확정하지 않은 제목');
});

it('does not begin preview generation when the test is closed during acceptance', async () => {
  const {session, provider, coordinator} = await setup();
  const preview = new StudioPreview(session.snapshot().project!.draft, 0, coordinator, () => {});
  await preview.session.load(); preview.session.change('시험');
  const pending = preview.session.send(); preview.dispose(); await pending;
  expect(provider.calls).toBe(0);
});

it('uses the pinned card for real generation and the unsaved draft in an isolated preview', async () => {
  const provider = response('대화 응답'), {repo, session, card, coordinator} = await setup(provider);
  session.setField('tone', '확정 말투'); const published = await session.publish();
  const room = await repo.createConversation(card.id);
  session.setField('tone', '시험 말투');
  const capture = vi.spyOn(provider, 'stream');
  const creation = new CreationService(repo, coordinator);
  await creation.send(session.snapshot().project!.draft, room.id, '안녕');
  expect((capture.mock.calls[0]![0] as AiRequest).context).toContain('확정 말투');
  const preview = new StudioPreview(session.snapshot().project!.draft, session.snapshot().project!.revision, coordinator, () => {});
  await preview.session.load(); preview.session.change('시험 인사'); await preview.session.send();
  expect(capture.mock.calls[1]![0].context).toContain('시험 말투');
  expect((await preview.store.messages(preview.session.conversationId)).at(-1)?.content).toBe('대화 응답');
  expect(await repo.messages(preview.session.conversationId)).toEqual([]);
  expect(await repo.conversations()).toHaveLength(1);
  expect((await repo.getCard(card.id)).publishedVersion).toBe(published.publishedVersion);
  preview.dispose();
});

it('migrates existing conversations by capturing the known card without rewriting history or buffers', async () => {
  const db = nodeDatabase(); databases.push(db); await migrate(db, migrations.slice(0, 6));
  const repo = new Repository(db), card = await repo.insertCard(newCard());
  await db.execute("INSERT INTO conversations(id,card_id,title,created_at,updated_at) VALUES('old',?,'기존 이름',1,1)", [card.id]);
  await repo.appendLocalUserMessage('old', '기존 대화'); await repo.saveBuffer({...card, description: '미저장'}, 0);
  await migrate(db);
  expect(await repo.getConversationCard('old')).toEqual(card);
  expect((await repo.messages('old'))[0]?.content).toBe('기존 대화');
  expect((await repo.getBuffer(card.id))?.card.description).toBe('미저장');
});
