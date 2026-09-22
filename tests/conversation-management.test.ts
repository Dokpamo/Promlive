import {afterEach, expect, it} from 'vitest';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {repository, nodeDatabase, FixtureProvider} from './helpers';
import {migrate, migrations} from '../src/adapters/sqlite/migrations';
import {Repository} from '../src/adapters/sqlite/repository';
import {newCard} from '../src/features/cards/model';
import {Workspace} from '../src/app/workspace';
import {CreationService} from '../src/features/chat/service';
import {GenerationCoordinator} from '../src/features/chat/generation';
import type {SqlDatabase} from '../src/ports/storage';
const opened: SqlDatabase[] = [];
afterEach(async () => {for (const db of opened.splice(0)) await db.close();});
async function setup(provider = new FixtureProvider()) {
  const repo = await repository(); opened.push(repo.db);
  const card = await repo.insertCard(newCard());
  const creation = new CreationService(repo, new GenerationCoordinator(provider));
  const workspace = new Workspace({repo, provider, creation});
  return {repo, card, creation, workspace};
}

it('upgrades existing histories without changing titles, messages or drafts', async () => {
  const db = nodeDatabase(); opened.push(db);
  await migrate(db, migrations.slice(0, 2));
  const repo = new Repository(db);
  const card = await repo.insertCard(newCard());
  const chat = await repo.createConversation(card.id, '기존 대화');
  await db.execute("INSERT INTO messages VALUES('old',?,1,'user','보존할 내용','completed',NULL,NULL,1)", [chat.id]);
  await repo.setSetting(`composer:${chat.id}`, '초안');
  await migrate(db);
  expect((await repo.conversations())[0]).toMatchObject({id: chat.id, title: '기존 대화', pinnedAt: null});
  expect((await repo.messages(chat.id))[0]?.content).toBe('보존할 내용');
  expect(await repo.getSetting(`composer:${chat.id}`)).toBe('초안');
});

it('persists pins and manual names across reopen, groups pinned first and restores recency on unpin', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'promlive-history-'));
  const file = join(dir, 'test.sqlite');
  let repo = await repository(file);
  try {
    const card = await repo.insertCard(newCard());
    const older = await repo.createConversation(card.id, '이전');
    const newer = await repo.createConversation(card.id, '최근');
    await repo.db.execute('UPDATE conversations SET updated_at=100 WHERE id=?', [older.id]);
    await repo.db.execute('UPDATE conversations SET updated_at=200 WHERE id=?', [newer.id]);
    await repo.pinConversation(older.id, true);
    await repo.renameConversation(older.id, '새로운 대화');
    await repo.db.close(); repo = await repository(file);
    expect((await repo.conversations()).map(item => item.id)).toEqual([older.id, newer.id]);
    await repo.appendLocalUserMessage(older.id, '수동으로 정한 이름을 바꾸면 안 됨');
    expect((await repo.conversations())[0]?.title).toBe('새로운 대화');
    await repo.db.execute('UPDATE conversations SET updated_at=100 WHERE id=?', [older.id]);
    await repo.pinConversation(older.id, false);
    expect((await repo.conversations()).map(item => item.id)).toEqual([newer.id, older.id]);
    await expect(repo.renameConversation(older.id, '  ')).rejects.toThrow();
  } finally {await repo.db.close(); rmSync(dir, {recursive: true, force: true});}
});

it('bulk deletes only selected histories and messages, and rejects late draft flushes', async () => {
  const {repo, card, workspace} = await setup();
  const first = await repo.createConversation(card.id);
  const second = await repo.createConversation(card.id);
  const keep = await repo.createConversation(card.id);
  for (const item of [first, second, keep]) {
    await repo.appendLocalUserMessage(item.id, item.id);
    await repo.saveComposerDraft(item.id, '초안');
  }
  await workspace.ready(); await workspace.openConversation(first);
  await workspace.deleteConversations([first.id, second.id, first.id]);
  expect(workspace.conversation?.id).toBe(keep.id);
  expect(await repo.messages(first.id)).toEqual([]);
  expect(await repo.messages(second.id)).toEqual([]);
  expect(await repo.messages(keep.id)).toHaveLength(1);
  await repo.saveComposerDraft(first.id, '화면이 닫히면서 도착한 초안');
  expect(await repo.getSetting(`composer:${first.id}`)).toBeUndefined();
  expect(await repo.getSetting(`composer:${keep.id}`)).toBe('초안');
  expect(await repo.getCard(card.id)).toMatchObject({id: card.id});
  await workspace.deleteConversations([keep.id]);
  expect(workspace.conversation).toBeNull();
  await workspace.startChat(card, true);
  expect(workspace.conversation?.cardId).toBe(card.id);
});

it('keeps the most recent room on startup even when an older room is pinned', async () => {
  const {repo, card, workspace} = await setup();
  const pinned = await repo.createConversation(card.id, '고정한 이전 대화');
  const recent = await repo.createConversation(card.id, '최근 대화');
  await repo.db.execute('UPDATE conversations SET updated_at=100 WHERE id=?', [pinned.id]);
  await repo.db.execute('UPDATE conversations SET updated_at=200 WHERE id=?', [recent.id]);
  await repo.pinConversation(pinned.id, true);
  await workspace.ready(); await workspace.startChat(card);
  expect(workspace.conversations[0]?.id).toBe(pinned.id);
  expect(workspace.conversation?.id).toBe(recent.id);
});

it('finishes cancellation before deleting a streaming conversation', async () => {
  let started!: () => void;
  const live = new Promise<void>(resolve => {started = resolve;});
  const provider = new FixtureProvider(async function* () {
    yield {type: 'delta', text: '부분 응답'};
    started();
    await new Promise(() => {});
  });
  const {repo, card, creation, workspace} = await setup(provider);
  const chat = await repo.createConversation(card.id);
  await workspace.ready(); await workspace.openConversation(chat);
  const send = creation.send(card, chat.id, '질문');
  await live;
  await workspace.deleteConversations([chat.id]);
  await send;
  expect(creation.live(chat.id)).toBeUndefined();
  expect(creation.lastError()).toBeNull();
  expect(await repo.messages(chat.id)).toEqual([]);
  expect(await repo.conversations()).toEqual([]);
});
