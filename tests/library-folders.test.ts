import {afterEach, expect, it} from 'vitest';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FolderLibrary} from '../src/features/library/FolderLibrary';
import {newCard} from '../src/features/cards/model';
import {migrate, migrations} from '../src/adapters/sqlite/migrations';
import {Repository} from '../src/adapters/sqlite/repository';
import {Workspace} from '../src/app/workspace';
import {CreationService} from '../src/features/chat/service';
import {GenerationCoordinator} from '../src/features/chat/generation';
import {FixtureProvider, nodeDatabase, repository} from './helpers';
import type {SqlDatabase} from '../src/ports/storage';
const opened: SqlDatabase[] = [];
afterEach(async () => {for (const db of opened.splice(0)) await db.close();});
async function setup() {
  const repo = await repository(); opened.push(repo.db);
  const a = await repo.insertCard({...newCard(), title: '첫 카드'}), b = await repo.insertCard({...newCard(), title: '다른 카드'});
  const chatA = await repo.createConversation(a.id), chatB = await repo.createConversation(b.id);
  const cards = new FolderLibrary({kind: 'card'}, repo.folderStore);
  const history = new FolderLibrary({kind: 'history', cardId: a.id}, repo.folderStore);
  return {repo, a, b, chatA, chatB, cards, history};
}

it('upgrades existing libraries without moving or rewriting cards, conversations, messages or drafts', async () => {
  const db = nodeDatabase(); opened.push(db); await migrate(db, migrations.slice(0, 5));
  const repo = new Repository(db), card = await repo.insertCard(newCard()), chat = await repo.createConversation(card.id);
  await repo.appendLocalUserMessage(chat.id, '기존 대화');
  await repo.saveBuffer({...card, description: '편집 중'}, card.revision);
  await migrate(db);
  expect(await repo.folderStore.read({kind: 'card'})).toEqual({folders: [], items: [{id: card.id, folderId: null}]});
  expect(await repo.getCard(card.id)).toEqual(card);
  expect((await repo.messages(chat.id))[0]?.content).toBe('기존 대화');
  expect((await repo.getBuffer(card.id))?.card.description).toBe('편집 중');
});
it('persists nested folders separately for cards and each card’s chat library across restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'promlive-folders-')), path = join(dir, 'app.sqlite');
  try {
    const first = await repository(path);
    const a = await first.insertCard(newCard()), b = await first.insertCard(newCard());
    const chat = await first.createConversation(a.id);
    const cards = new FolderLibrary({kind: 'card'}, first.folderStore), chats = new FolderLibrary({kind: 'history', cardId: a.id}, first.folderStore);
    const parent = await cards.createFolder('보관'), child = await cards.createFolder('이야기', [a.id], parent.id);
    const historyFolder = await chats.createFolder('보관', [chat.id]);
    await first.db.close();
    const second = await repository(path);
    try {
      expect((await second.folderStore.read({kind: 'card'})).items.find(item => item.id === a.id)?.folderId).toBe(child.id);
      expect((await second.folderStore.read({kind: 'history', cardId: a.id})).items).toEqual([{id: chat.id, folderId: historyFolder.id}]);
      expect((await second.folderStore.read({kind: 'history', cardId: b.id})).folders).toEqual([]);
      expect((await second.getCard(a.id)).revision).toBe(0);
    } finally {await second.db.close();}
  } finally {rmSync(dir, {recursive: true, force: true});}
});
it('rejects cross-card moves, foreign destinations and cyclic folder moves without changing saved data', async () => {
  const {repo, a, b, chatA, chatB, cards, history} = await setup();
  const root = await history.createFolder('부모', [chatA.id]), child = await history.createFolder('자식', [], root.id);
  const cardFolder = await cards.createFolder('카드');
  const before = await repo.folderStore.read(history.scope);
  await expect(history.move([chatB.id], root.id)).rejects.toThrow('항목을 찾을 수 없어요');
  await expect(history.move([chatA.id], cardFolder.id)).rejects.toThrow('폴더를 찾을 수 없어요');
  await expect(history.move([], child.id, [root.id])).rejects.toThrow('하위 폴더');
  await expect(repo.deleteConversations([chatB.id], {scope: history.scope, folderIds: [root.id]})).rejects.toThrow('다른 목록');
  await expect(repo.deleteCards([a.id], {scope: history.scope, folderIds: [root.id]})).rejects.toThrow('일치하지');
  expect(await repo.folderStore.read(history.scope)).toEqual(before);
  expect((await repo.conversations()).map(item => item.cardId).sort()).toEqual([a.id, b.id].sort());
});
it('creates a parent around mixed selections atomically, preserving selected descendants and edits', async () => {
  const {repo, a, b, cards} = await setup();
  const parent = await cards.createFolder('기존', [a.id]), child = await cards.createFolder('하위', [], parent.id);
  await repo.saveBuffer({...a, description: '보존할 초안'}, a.revision);
  await repo.updateMetadata(a.id, {title: '새 제목', pinnedAt: 123});
  const wrapper = await cards.createFolder('묶음', [a.id, b.id], null, [parent.id, child.id]);
  const value = cards.snapshot().value;
  expect(value.folders.find(item => item.id === parent.id)?.parentId).toBe(wrapper.id);
  expect(value.folders.find(item => item.id === child.id)?.parentId).toBe(parent.id);
  expect(value.items.find(item => item.id === a.id)?.folderId).toBe(parent.id);
  expect(value.items.find(item => item.id === b.id)?.folderId).toBe(wrapper.id);
  expect((await repo.getCard(a.id)).title).toBe('새 제목');
  expect((await repo.getBuffer(a.id))?.card.description).toBe('보존할 초안');
});
it('rolls back folder creation when filing an item fails, and allows a later retry', async () => {
  const {repo, a, cards} = await setup();
  await repo.db.execute("CREATE TRIGGER reject_location BEFORE INSERT ON library_card_locations BEGIN SELECT RAISE(ABORT,'disk failure'); END");
  await expect(cards.createFolder('실패', [a.id])).rejects.toThrow('disk failure');
  expect((await repo.folderStore.read(cards.scope)).folders).toEqual([]);
  await repo.db.execute('DROP TRIGGER reject_location');
  const folder = await cards.createFolder('성공', [a.id]);
  expect(cards.snapshot().value.items.find(item => item.id === a.id)?.folderId).toBe(folder.id);
});
it('serializes concurrent creations and moves against current storage instead of replacing newer trees', async () => {
  const {a, b, cards} = await setup();
  const [first, second] = await Promise.all([cards.createFolder('하나', [a.id]), cards.createFolder('둘', [b.id])]);
  await Promise.all([cards.move([a.id], second.id), cards.renameFolder(first.id, '첫 폴더')]);
  await cards.refresh();
  expect(cards.snapshot().value.folders.map(item => item.name)).toEqual(['첫 폴더', '둘']);
  expect(cards.snapshot().value.items.every(item => item.folderId === second.id)).toBe(true);
  await expect(cards.renameFolder(first.id, '둘')).rejects.toThrow('같은 이름');
});
it('deletes only explicitly selected entries and promotes unselected nested contents to a surviving parent', async () => {
  const {repo, a, b, cards} = await setup();
  const outer = await cards.createFolder('유지'), parent = await cards.createFolder('삭제할 폴더', [a.id], outer.id);
  const child = await cards.createFolder('하위', [b.id], parent.id), keep = await cards.createFolder('유지할 하위', [], child.id);
  await repo.deleteCards([a.id], {scope: cards.scope, folderIds: [parent.id, child.id]});
  const value = await repo.folderStore.read(cards.scope);
  expect(value.items).toEqual([{id: b.id, folderId: outer.id}]);
  expect(value.folders.find(item => item.id === keep.id)?.parentId).toBe(outer.id);
  expect((await repo.conversations()).map(item => item.cardId)).toEqual([b.id]);
});
it('rolls back folder removal and item promotion together when a selected card cannot be deleted', async () => {
  const {repo, a, b, cards} = await setup();
  const folder = await cards.createFolder('보관', [a.id, b.id]);
  const before = await repo.folderStore.read(cards.scope);
  await repo.db.execute("CREATE TRIGGER reject_card BEFORE DELETE ON cards BEGIN SELECT RAISE(ABORT,'delete failed'); END");
  await expect(repo.deleteCards([a.id], {scope: cards.scope, folderIds: [folder.id]})).rejects.toThrow('delete failed');
  expect(await repo.folderStore.read(cards.scope)).toEqual(before);
  expect(await repo.listCards()).toHaveLength(2);
});
it('cascades deleted cards’ history folders without removing another card’s folders', async () => {
  const {repo, a, b, chatA, chatB, cards, history} = await setup();
  const cardFolder = await cards.createFolder('카드 보관', [a.id, b.id]);
  await history.createFolder('대화', [chatA.id]);
  const other = new FolderLibrary({kind: 'history', cardId: b.id}, repo.folderStore);
  const keep = await other.createFolder('대화', [chatB.id]);
  await repo.deleteCards([a.id]);
  expect((await repo.db.execute("SELECT id FROM library_folders WHERE kind='history'")).rows).toEqual([{id: keep.id}]);
  expect((await repo.folderStore.read(cards.scope)).items).toEqual([{id: b.id, folderId: cardFolder.id}]);
  expect((await repo.db.execute('PRAGMA foreign_key_check')).rows).toEqual([]);
});
it('supports folder-only removals through workspace and history owners without deleting their contents', async () => {
  const {repo, a, chatA} = await setup();
  const provider = new FixtureProvider(), workspace = new Workspace({repo, provider, creation: new CreationService(repo, new GenerationCoordinator(provider))});
  await workspace.ready();
  const folder = await workspace.cardFolders.createFolder('보관', [a.id]);
  await workspace.cardActions.remove([], {scope: {kind: 'card'}, folderIds: [folder.id]});
  expect(workspace.cards).toHaveLength(2);
  const history = workspace.history.folderLibrary(a.id)!;
  const chatFolder = await history.createFolder('보관', [chatA.id]);
  await workspace.history.remove([], {scope: history.scope, folderIds: [chatFolder.id]});
  expect((await repo.folderStore.read(history.scope)).items).toEqual([{id: chatA.id, folderId: null}]);
  expect(workspace.history.items).toHaveLength(2);
});
