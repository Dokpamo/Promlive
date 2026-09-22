import {afterEach, expect, it, vi} from 'vitest';
import {repository} from './helpers';
import {newCard} from '../src/features/cards/model';
import {MessageHistory} from '../src/features/chat/messageHistory';
import type {SqlDatabase} from '../src/ports/storage';

const opened: SqlDatabase[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const db of opened.splice(0)) await db.close();
});

async function setup(count: number) {
  const repo = await repository();
  opened.push(repo.db);
  const card = await repo.insertCard(newCard());
  const conversation = await repo.createConversation(card.id);
  for (let index = 1; index <= count; index++) await repo.appendLocalUserMessage(conversation.id, `기록 ${index}`);
  const history = new MessageHistory(repo, conversation.id);
  await history.refresh();
  return {repo, conversation, history};
}

it.each([0, 40, 41, 80])('reports the older-page boundary accurately with %i saved messages', async count => {
  const {history} = await setup(count);
  expect(history.snapshot().messages).toHaveLength(Math.min(count, 40));
  expect(history.snapshot().hasMore).toBe(count > 40);
  await history.loadOlder();
  expect(history.snapshot().messages).toHaveLength(count);
  expect(history.snapshot().hasMore).toBe(false);
});

it('bridges new messages spanning several pages without gaps or duplicates', async () => {
  const {repo, conversation, history} = await setup(50);
  for (let index = 51; index <= 145; index++) await repo.appendLocalUserMessage(conversation.id, `기록 ${index}`);
  await history.refresh();
  expect(history.snapshot().messages.map(message => message.sequence)).toEqual(Array.from({length: 135}, (_, index) => index + 11));
  expect(history.snapshot().hasMore).toBe(true);
  await history.loadOlder();
  expect(history.snapshot().messages.map(message => message.sequence)).toEqual(Array.from({length: 145}, (_, index) => index + 1));
  expect(history.snapshot().hasMore).toBe(false);
});

it('serializes refreshes with pagination and coalesces repeated older-page requests', async () => {
  const {repo, conversation, history} = await setup(90);
  const read = repo.messages.bind(repo);
  let started!: () => void;
  const reading = new Promise<void>(resolve => {started = resolve;});
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  const reads = vi.spyOn(repo, 'messages').mockImplementationOnce(async (...args) => {
    const page = await read(...args);
    started();
    await gate;
    return page;
  });
  const older = history.loadOlder();
  expect(history.loadOlder()).toBe(older);
  await reading;
  await repo.appendLocalUserMessage(conversation.id, '나중에 보낸 메시지');
  const refresh = history.refresh();
  release();
  await Promise.all([older, refresh]);
  expect(reads).toHaveBeenCalledTimes(2);
  expect(history.snapshot().messages.map(message => message.sequence)).toEqual(Array.from({length: 81}, (_, index) => index + 11));
  expect(history.snapshot()).toMatchObject({hasMore: true, loadingOlder: false});
});

it('keeps the loaded range on a read failure and allows retrying it', async () => {
  const {repo, history} = await setup(41);
  const before = history.snapshot().messages;
  vi.spyOn(repo, 'messages').mockRejectedValueOnce(new Error('읽기 실패'));
  await expect(history.loadOlder()).rejects.toThrow('읽기 실패');
  expect(history.snapshot()).toMatchObject({messages: before, hasMore: true, loadingOlder: false});
  await history.loadOlder();
  expect(history.snapshot().messages).toHaveLength(41);
  expect(history.snapshot().hasMore).toBe(false);
});
