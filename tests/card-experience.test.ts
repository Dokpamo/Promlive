import {afterEach, expect, it, vi} from 'vitest';
import {repository, FixtureProvider, nodeDatabase} from './helpers';
import {newCard, cardContext} from '../src/features/cards/model';
import {activeResources, experienceSchema, getExperience, initialScene, newResource, newStart, removeResource, type CardExperience} from '../src/features/cards/experience';
import {SqliteAuthoringStore} from '../src/adapters/sqlite/authoringStore';
import {exportCardBundle, parseCardBundle} from '../src/features/authoring/cardBundle';
import {AuthoringAssistant} from '../src/features/authoring/AuthoringAssistant';
import {AuthoringSession} from '../src/features/authoring/AuthoringSession';
import {GenerationCoordinator} from '../src/features/chat/generation';
import {CreationService} from '../src/features/chat/service';
import {StudioPreview} from '../src/features/authoring/StudioPreview';
import {changeFields, fieldValue} from '../src/features/authoring/model';
import {defaultPocket, pocketValues} from '../src/features/cards/pocket';
import {Workspace} from '../src/app/workspace';
import {migrate, migrations} from '../src/adapters/sqlite/migrations';
import {Repository} from '../src/adapters/sqlite/repository';
import type {SqlDatabase} from '../src/ports/storage';

const dbs: SqlDatabase[] = [], sessions: AuthoringSession[] = [];
afterEach(async () => {for (const s of sessions.splice(0)) await s.close(); for (const db of dbs.splice(0)) await db.close();});
function world(): CardExperience {
  const library = {...newResource('place', 'library', '도서관'), prompt: 'LIBRARY_ONLY'};
  const vault = {...newResource('place', 'vault', '금고'), prompt: 'VAULT_ONLY', activation: {...library.activation, conditions: [{key: '열쇠', operator: 'is' as const, value: '있음'}]}};
  const librarian = {...newResource('character', 'librarian', '사서'), prompt: 'LIBRARIAN_ONLY', activation: {...library.activation, mode: 'conditional' as const, locations: ['library']}};
  const knight = {...newResource('character', 'knight', '기사'), prompt: 'KNIGHT_ONLY'};
  return {version: 1, direction: '문체 지침', resources: [{...newResource('world', 'world', '밤의 도시'), prompt: 'WORLD_ALWAYS'}, library, vault, librarian, knight],
    starts: [{...newStart('entrance', '도서관에서'), locationId: 'library', prompt: 'ENTRANCE_START', greeting: '도서관에 어서 와요.'}, {...newStart('heist', '기사와 금고에서'), locationId: 'vault', prompt: 'HEIST_START', activeIds: ['knight'], flags: {'열쇠': '있음'}, greeting: '금고를 열었다.'}], defaultStartId: 'entrance'};
}
async function storage() {const repo = await repository(); dbs.push(repo.db); return {repo, store: new SqliteAuthoringStore(repo.db)};}

it('preserves legacy world/person/greeting as a world and a selectable start', () => {
  const card = newCard(); if (card.body.kind !== 'template') throw new Error();
  card.body.data = {...card.body.data, world: '옛 세계', rules: '규칙', characterName: '서린', personality: '차분함', greeting: '안녕', tone: '존댓말'};
  const next = getExperience(card);
  expect(next.resources[0]!.prompt).toContain('옛 세계'); expect(next.resources[0]!.prompt).toContain('규칙');
  expect(next.resources[1]!.name).toBe('서린'); expect(next.starts[0]!.greeting).toBe('안녕'); expect(next.direction).toBe('존댓말');
});
it('includes only the selected location, matching conditions and enabled manual characters', () => {
  const experience = world(), card = {...newCard(), experience}; const state = initialScene(experience);
  let context = cardContext(card, state);
  expect(context).toContain('WORLD_ALWAYS'); expect(context).toContain('LIBRARY_ONLY'); expect(context).toContain('LIBRARIAN_ONLY');
  expect(context).not.toContain('VAULT_ONLY'); expect(context).not.toContain('KNIGHT_ONLY'); expect(context).not.toContain('HEIST_START');
  const heist = initialScene(experience, 'heist'); context = cardContext(card, heist);
  expect(context).toContain('VAULT_ONLY'); expect(context).toContain('KNIGHT_ONLY'); expect(context).toContain('HEIST_START'); expect(context).not.toContain('LIBRARY_ONLY');
  expect(activeResources(experience, {...heist, flags: {'열쇠': '없음'}}).map(r => r.id)).not.toContain('vault');
  expect(activeResources(experience, {...heist, activeIds: []}).map(r => r.id)).not.toContain('knight');
});
it('validates references and cleans dependent starts/conditions when a place is removed', () => {
  const experience = world();
  expect(() => experienceSchema.parse({...experience, resources: [...experience.resources, experience.resources[0]]})).toThrow();
  expect(() => experienceSchema.parse({...experience, defaultStartId: 'missing'})).toThrow();
  expect(() => experienceSchema.parse({...experience, starts: [{...experience.starts[0], locationId: 'missing'}]})).toThrow();
  const next = experienceSchema.parse(removeResource(experience, 'library'));
  expect(next.starts[0]!.locationId).toBeNull(); expect(next.resources.find(r => r.id === 'librarian')!.activation.locations).toEqual([]);
  expect(() => removeResource(next, 'world')).toThrow();
});
it('pins the chosen start and saves scene changes independently for each conversation', async () => {
  const {repo, store} = await storage(); const card = await repo.insertCard({...newCard(), experience: world(), studioDraft: true});
  const opened = await store.open(card.id); const published = await store.publish(opened.project, opened.storageRevision);
  const first = await repo.createConversation(card.id), second = await repo.createConversation(card.id, undefined, 'heist');
  expect((await repo.messages(first.id))[0]!.content).toBe('도서관에 어서 와요.');
  expect((await repo.messages(second.id))[0]!.content).toBe('금고를 열었다.');
  await repo.setSceneState(first.id, {...(await repo.getSceneState(first.id))!, flags: {'열쇠': '새 상태'}});
  expect((await repo.getSceneState(second.id))!.flags).toEqual({'열쇠': '있음'});
  expect((await repo.getConversationCard(first.id))!.publishedVersion).toBe(published.card.publishedVersion);
});
it('uses current scene rules in actual production generation and keeps preview scenes isolated', async () => {
  const {repo, store} = await storage(); const experience = world();
  experience.starts[1]!.intro = {kind: 'text', text: 'VIEWER_ONLY_INTRO'};
  const card = await repo.insertCard({...newCard(), experience, studioDraft: true});
  const opened = await store.open(card.id); const {card: published} = await store.publish(opened.project, opened.storageRevision);
  const room = await repo.createConversation(card.id, undefined, 'heist');
  const provider = new FixtureProvider(); const stream = vi.spyOn(provider, 'stream');
  const coordinator = new GenerationCoordinator(provider), service = new CreationService(repo, coordinator);
  await service.send(published, room.id, '진행해 줘'); expect(stream.mock.calls[0]![0].context).toContain('VAULT_ONLY');
  expect(stream.mock.calls[0]![0].messages).toEqual([{role: 'assistant', content: '금고를 열었다.'}]);
  expect(JSON.stringify(stream.mock.calls[0]![0])).not.toContain('VIEWER_ONLY_INTRO');
  await repo.setSceneState(room.id, {...(await repo.getSceneState(room.id))!, flags: {'열쇠': '없음'}});
  await service.send(published, room.id, '다음'); expect(stream.mock.calls[1]![0].context).not.toContain('VAULT_ONLY');
  const preview = new StudioPreview(published, 0, coordinator, () => {}, 'entrance');
  expect((await preview.store.getSceneState())!.locationId).toBe('library');
  await preview.store.setSceneState(preview.session.conversationId, initialScene(world(), 'heist'));
  expect((await repo.getSceneState(room.id))!.flags['열쇠']).toBe('없음'); preview.dispose();
});

it('keeps pocket templates, tags and viewer intros through publication and sharing', async () => {
  const {repo, store} = await storage();
  let draft = {...newCard(), experience: world()};
  draft.experience.starts[0]!.intro = {kind: 'text', text: '사용자 전용 도입'};
  draft = {...changeFields(draft, [{field: 'tags', value: '판타지, 다인물, 판타지, #시뮬레이션'}]), experience: draft.experience};
  const pocket = {...defaultPocket(draft), title: '헌터 정보', template: 'list' as const};
  const card = await repo.insertCard({...draft, pocket});
  const opened = await store.open(card.id), {card: published} = await store.publish(opened.project, opened.storageRevision);
  const imported = await store.importBundle((await exportCardBundle(published, store)).contents);
  expect(imported.tags).toEqual(['판타지', '다인물', '시뮬레이션']);
  expect(imported.pocket).toEqual(pocket);
  expect(imported.experience!.starts[0]!.intro).toEqual({kind: 'text', text: '사용자 전용 도입'});
  const values = pocketValues(imported, imported.pocket!, initialScene(imported.experience!, 'heist'));
  expect(values.map(item => [item.label, item.value])).toEqual([['현재 장소', '금고'], ['등장인물', '기사'], ['열쇠', '있음']]);
  expect(pocketValues(imported, pocket, {...initialScene(imported.experience!, 'heist'), flags: {}}).at(-1)!.value).toBe('—');
});

it('flushes and releases the studio when a room is opened from the side list', async () => {
  const {repo, store} = await storage(); const provider = new FixtureProvider();
  const creation = new CreationService(repo, new GenerationCoordinator(provider));
  const workspace = new Workspace({repo, provider, creation, authoring: store});
  const card = await repo.insertCard(newCard()), room = await repo.createConversation(card.id);
  await workspace.ready(); await workspace.openStudio(card.id);
  workspace.studio!.setField('description', '이동 직전에 입력한 초안');
  await workspace.openConversation(room);
  expect(workspace.page).toBe('chat'); expect(workspace.studio).toBeNull();
  expect((await store.open(card.id)).project.draft.description).toBe('이동 직전에 입력한 초안');
  await workspace.openStudio(card.id);
  await workspace.cardActions.pin(card.id, true);
  workspace.studio!.setField('description', '고정한 뒤의 초안');
  await workspace.studio!.flush();
  await workspace.startChat(card, true);
  expect(workspace.studio).toBeNull();
  expect((await store.open(card.id)).project.draft.description).toBe('고정한 뒤의 초안');
});
it('round-trips content and assets without creator chat, credentials, room history or identity collisions', async () => {
  const {repo, store} = await storage();
  const asset = await store.putAsset({uri: 'data:image/png;base64,aGVsbG8=', width: 1, height: 1, name: '표지.png'});
  const experience = world(); experience.resources[0]!.assetIds = [asset.id];
  const card = await repo.insertCard({...newCard(), title: '공유 세계', coverAssetId: asset.id, experience, studioDraft: true});
  const opened = await store.open(card.id); opened.project.prompt = 'PRIVATE_CREATION_CHAT';
  const {card: published} = await store.publish(opened.project, opened.storageRevision);
  await repo.setSetting('test:secret', 'PRIVATE_API_SECRET'); await repo.createConversation(card.id);
  const bundle = await exportCardBundle(published, store);
  expect(bundle.filename).toBe('공유 세계.promcard'); expect(bundle.contents).not.toContain('PRIVATE_CREATION_CHAT'); expect(bundle.contents).not.toContain('PRIVATE_API_SECRET');
  expect(parseCardBundle(bundle.contents).assets).toHaveLength(1);
  const imported = await store.importBundle(bundle.contents);
  expect(imported.id).not.toBe(card.id); expect(imported.coverAssetId).not.toBe(asset.id); expect(imported.publishedVersion).not.toBe(published.publishedVersion);
  expect(imported.experience!.resources[0]!.assetIds).toEqual([imported.coverAssetId]); expect(await store.getAsset(imported.coverAssetId!)).toMatchObject({uri: asset.uri});
  expect((await repo.conversations(imported.id))).toHaveLength(0);
  const reexport = parseCardBundle((await exportCardBundle(imported, store)).contents); expect(reexport.card.experience).toEqual(imported.experience);
});
it('rejects malformed/missing assets and imports atomically when storage fails', async () => {
  const {repo, store} = await storage();
  const published = await repo.insertCard({...newCard(), publishedVersion: 'v1'});
  const file = await exportCardBundle(published, store); const body = JSON.parse(file.contents);
  expect(() => parseCardBundle(JSON.stringify({...body, version: 2}))).toThrow();
  expect(() => parseCardBundle(JSON.stringify({...body, card: {...body.card, coverAssetId: 'missing'}}))).toThrow();
  body.assets.push({id: 'asset', uri: 'data:image/png;base64,aGVsbG8=', width: 1, height: 1}); body.card.coverAssetId = 'asset';
  await repo.db.execute("CREATE TRIGGER reject_card_import BEFORE INSERT ON card_versions BEGIN SELECT RAISE(ABORT,'test storage failure'); END");
  await expect(store.importBundle(JSON.stringify(body))).rejects.toThrow('test storage failure');
  expect((await repo.listCards())).toHaveLength(1); expect((await repo.db.execute('SELECT id FROM card_assets')).rows).toHaveLength(0);
});
it('applies/undoes structured AI edits with normalized receipts and rejects invented assets', async () => {
  const {repo, store} = await storage(); const card = await repo.insertCard({...newCard(), studioDraft: true});
  let result = JSON.stringify({kind: 'change', message: '도서관과 금고를 만들었어요.', changes: [{field: 'structure', value: JSON.stringify(world(), null, 2)}]});
  const provider = new FixtureProvider(async function* () {yield {type: 'delta', text: result}; yield {type: 'done'};});
  const session = new AuthoringSession(card.id, store, new AuthoringAssistant(new GenerationCoordinator(provider))); sessions.push(session); await session.load();
  await session.generate('세계 만들기'); expect(session.snapshot().project!.draft.experience!.resources).toHaveLength(5);
  const receipt = session.snapshot().project!.changes[0]!; await session.undo(receipt.id); expect(getExperience(session.snapshot().project!.draft).resources).toHaveLength(1);
  const before = fieldValue(session.snapshot().project!.draft, 'structure'); const bad = world(); bad.resources[0]!.assetIds = ['invented'];
  result = JSON.stringify({kind: 'change', message: '', changes: [{field: 'structure', value: JSON.stringify(bad)}]});
  await session.generate('이미지 만들기'); expect(session.snapshot().project!.messages.at(-1)!.status).toBe('failed'); expect(fieldValue(session.snapshot().project!.draft, 'structure')).toBe(before);
});
it('does not overwrite a resource being edited while a whole-world AI request completes', async () => {
  const {repo, store} = await storage(); const card = await repo.insertCard({...newCard(), experience: world(), studioDraft: true});
  const changed = world(); changed.resources[0]!.prompt = 'AI WORLD';
  const provider = new FixtureProvider(async function* () {yield {type: 'delta', text: JSON.stringify({kind: 'change', message: '', changes: [{field: 'structure', value: JSON.stringify(changed)}]})}; yield {type: 'done'};});
  const session = new AuthoringSession(card.id, store, new AuthoringAssistant(new GenerationCoordinator(provider))); sessions.push(session); await session.load(); session.setFocusedField('resource:world');
  await session.generate('다시 써 줘'); expect(session.snapshot().project!.messages.at(-1)!.status).toBe('conflict'); expect(getExperience(session.snapshot().project!.draft).resources[0]!.prompt).toBe('WORLD_ALWAYS');
});
it('migrates existing image assets and conversations from database v7 without losing content', async () => {
  const db = nodeDatabase(); dbs.push(db); await migrate(db, migrations.slice(0, 7));
  const repo = new Repository(db); const card = await repo.insertCard(newCard());
  await db.execute('INSERT INTO card_assets(id,uri,width,height) VALUES(?,?,?,?)', ['legacy', 'data:image/png;base64,aGVsbG8=', 1, 1]);
  await migrate(db); expect((await repo.getCard(card.id)).title).toBe(card.title);
  expect(await new SqliteAuthoringStore(db).getAsset('legacy')).toMatchObject({id: 'legacy', width: 1});
});
