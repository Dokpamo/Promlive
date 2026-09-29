import {afterEach, expect, it} from 'vitest';
import {repository, FixtureProvider} from './helpers';
import {Workspace} from '../src/app/workspace';
import {cardCreatorName, categoryCards, conversationCards, createdCards, generalChatCardId, libraryCards} from '../src/app/collections';
import {newCard, type Card} from '../src/features/cards/model';
import {CreationService} from '../src/features/chat/service';
import {GenerationCoordinator} from '../src/features/chat/generation';
import {SqliteAuthoringStore} from '../src/adapters/sqlite/authoringStore';
import {exportCardBundle, parseCardBundle} from '../src/features/authoring/cardBundle';
import type {Repository} from '../src/adapters/sqlite/repository';
import {userProfileKey} from '../src/features/profile/userProfile';

let repo: Repository | undefined;
let workspace: Workspace | undefined;
afterEach(async () => {await workspace?.studio?.close(); workspace = undefined; await repo?.db.close(); repo = undefined;});
async function setup() {
  repo = await repository();
  const provider = new FixtureProvider(), store = new SqliteAuthoringStore(repo.db);
  workspace = new Workspace({repo, provider, creation: new CreationService(repo, new GenerationCoordinator(provider)), authoring: store});
  await workspace.ready();
  return {repo, store, w: workspace};
}

it('starts at the library without creating a card or conversation', async () => {
  const {w} = await setup();
  expect(w.page).toBe('library');
  expect(w.cards).toEqual([]);
  expect(w.history.items).toEqual([]);
});

it('separates unfinished, imported, example and created cards without losing legacy cards', () => {
  const local = {...newCard(), title: '내 카드'}, draft = {...newCard(), studioDraft: true};
  const imported: Card = {...newCard(), origin: 'imported'}, example = {...newCard(), example: true};
  const {origin: _origin, ...legacy} = newCard();
  const cards = [local, draft, imported, example, legacy, {...newCard(), archived: true}, {...newCard(), id: generalChatCardId}];
  expect(libraryCards(cards)).toEqual([local, imported, example, legacy]);
  expect(createdCards(cards)).toEqual([local, draft, legacy]);
});

it('imports a shared card into the library without opening the editor, and remembers its origin', async () => {
  const {repo, store, w} = await setup();
  const file = await exportCardBundle({...newCard(), title: '받은 카드', creator: '다른 제작자'}, store);
  const imported = await w.importLibrary(file.contents);
  expect(w.page).toBe('library'); expect(w.studio).toBeNull();
  expect(libraryCards(w.cards).map(card => card.id)).toEqual([imported.id]);
  expect(createdCards(w.cards)).toEqual([]);
  expect(await repo.getCard(imported.id)).toMatchObject({origin: 'imported', studioDraft: false});
  const exported = parseCardBundle((await exportCardBundle(imported, store)).contents);
  expect(exported.card.title).toBe('받은 카드');
  expect(exported.card.creator).toBe('다른 제작자');
  expect(cardCreatorName(imported, '내 이름')).toBe('다른 제작자');
  expect(exported.card).not.toHaveProperty('origin');
});

it('preserves a new studio draft when returning to the main tabs and lists it in the library only after publication', async () => {
  const {store, w} = await setup();
  await w.runtime.repo.setSetting(userProfileKey, JSON.stringify({version: 1, name: '처음 제작자', image: null}));
  await w.createStudio();
  const id = w.studio!.cardId;
  w.studio!.setField('title', '저장한 제작물');
  w.studio!.setPrompt('아직 보내지 않은 요청');
  await w.closeStudio('library');
  expect(w.page).toBe('library'); expect(w.studio).toBeNull();
  expect(createdCards(w.cards).map(card => card.id)).toEqual([id]);
  expect(libraryCards(w.cards)).toEqual([]);
  const draft = await store.open(id);
  expect(draft.project.draft.title).toBe('저장한 제작물');
  expect(draft.project.draft.creator).toBe('처음 제작자');
  expect(draft.project.prompt).toBe('아직 보내지 않은 요청');
  await store.publish(draft.project, draft.storageRevision);
  await w.refresh();
  expect(libraryCards(w.cards).map(card => card.id)).toEqual([id]);
  expect(createdCards(w.cards).map(card => card.id)).toEqual([id]);
});

it('keeps manual categories editable, filters nested contents, and never recreates deleted presets', async () => {
  const {repo, w} = await setup();
  await w.cardFolders.refresh();
  const [recent, idle] = w.cardFolders.snapshot().value.folders;
  expect([recent?.name, idle?.name]).toEqual(['요즘 한 거', '방치중']);
  const a = await repo.insertCard(newCard()), b = await repo.insertCard(newCard());
  const child = await w.cardFolders.createFolder('짧게 할 것', [a.id], recent!.id);
  await w.cardFolders.move([b.id], idle!.id);
  const tree = w.cardFolders.snapshot().value;
  expect(categoryCards([a, b], tree, null)).toEqual([a, b]);
  expect(categoryCards([a, b], tree, recent!.id)).toEqual([a]);
  expect(categoryCards([a, b], tree, child.id)).toEqual([a]);
  await w.cardFolders.renameFolder(recent!.id, '다음에 할 것');
  await w.cardActions.remove([], {scope: w.cardFolders.scope, folderIds: [idle!.id]});
  await w.ready(); await w.cardFolders.refresh();
  expect(w.cardFolders.snapshot().value.folders.map(folder => folder.name)).toEqual(['다음에 할 것', '짧게 할 것']);
  expect(await repo.getCard(b.id)).toEqual(b);
  expect(w.cardFolders.snapshot().value.items.find(item => item.id === b.id)?.folderId).toBeNull();
});

it('groups and searches conversations by card and keeps existing rooms when navigating back', async () => {
  const {repo, w} = await setup();
  const first = await repo.insertCard({...newCard(), title: '숲'}), second = await repo.insertCard({...newCard(), title: '도시'});
  const firstRoom = await repo.createConversation(first.id), secondRoom = await repo.createConversation(second.id);
  const latestRoom = await repo.createConversation(first.id);
  await w.refresh();
  const rooms = [{...firstRoom, updatedAt: 1}, {...secondRoom, updatedAt: 2}, {...latestRoom, updatedAt: 3, preview: '숨겨진 열쇠'}];
  expect(conversationCards(w.cards, rooms).map(group => [group.card.title, group.count, group.latest.id])).toEqual([
    ['숲', 2, latestRoom.id], ['도시', 1, secondRoom.id],
  ]);
  expect(conversationCards(w.cards, rooms, '열쇠').map(group => group.card.id)).toEqual([first.id]);
  await w.openConversation(firstRoom); await w.go('library');
  expect(w.page).toBe('library'); expect(w.history.items).toHaveLength(3);
  await w.openConversation(firstRoom);
  expect(w.history.selected?.id).toBe(firstRoom.id); expect(w.history.items).toHaveLength(3);
});
