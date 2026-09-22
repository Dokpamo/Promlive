import {afterEach, expect, it, vi} from 'vitest';
import {repository} from './helpers';
import {CardEditor} from '../src/features/cards/CardEditor';
import {newCard} from '../src/features/cards/model';
import {ConversationList} from '../src/features/chat/ConversationList';
import {Notifications} from '../src/app/Notifications';
import type {Repository} from '../src/adapters/sqlite/repository';

const opened: Repository[] = [];
afterEach(async () => {vi.restoreAllMocks(); for (const repo of opened.splice(0)) await repo.db.close();});
function deferred() {let resolve!: () => void; const promise = new Promise<void>(done => {resolve = done;}); return {promise, resolve};}
async function setup() {
  const repo = await repository(); opened.push(repo);
  const card = await repo.insertCard(newCard());
  const report = vi.fn();
  const editor = new CardEditor(repo, {report, committed: async () => {}});
  const history = new ConversationList(repo, ids => repo.deleteConversations(ids));
  return {repo, card, editor, history, report};
}

it('lets the latest card load win and keeps pending saves independent from a later editor', async () => {
  const {repo, card, editor} = await setup();
  const other = await repo.insertCard({...newCard(), title: '다른 카드'});
  const gate = deferred();
  const get = repo.getCard.bind(repo);
  vi.spyOn(repo, 'getCard').mockImplementation(async id => {if (id === card.id) await gate.promise; return get(id);});
  const oldOpen = editor.open(card.id);
  await editor.open(other.id);
  gate.resolve(); await oldOpen;
  expect(editor.state?.card.id).toBe(other.id);
  editor.edit({title: '다른 카드 변경'}); await editor.save();
  expect((await repo.getCard(other.id)).title).toBe('다른 카드 변경');
});

it('keeps recovery writes ordered and retries a failed buffer write without losing newer text', async () => {
  const {repo, card, editor} = await setup(); await editor.open(card.id);
  const gate = deferred(); const entered = deferred();
  const store = repo.saveBuffer.bind(repo);
  vi.spyOn(repo, 'saveBuffer').mockImplementationOnce(async () => {entered.resolve(); await gate.promise; throw new Error('disk unavailable');}).mockImplementation(store);
  editor.edit({title: '이전 편집'});
  const first = editor.flush(); const failure = expect(first).rejects.toThrow('disk unavailable');
  await entered.promise;
  editor.edit({title: '최신 편집'});
  const second = editor.flush(); gate.resolve();
  await failure; await second;
  expect(await repo.getBuffer(card.id)).toMatchObject({card: {title: '최신 편집'}});
  expect(editor.state).toMatchObject({dirty: true, status: 'buffered', card: {title: '최신 편집'}});
});

it('reopening during a save does not resurrect a buffer or lose edits made while saving', async () => {
  const {repo, card, editor} = await setup(); await editor.open(card.id);
  const gate = deferred(); const entered = deferred();
  const save = repo.saveCard.bind(repo);
  vi.spyOn(repo, 'saveCard').mockImplementationOnce(async (...args) => {entered.resolve(); await gate.promise; return save(...args);});
  editor.edit({title: '저장한 제목'});
  const pending = editor.save(); await entered.promise;
  editor.edit({description: '저장 도중 입력'}); await editor.flush();
  const reopen = editor.open(card.id); gate.resolve(); await pending; await reopen;
  expect(editor.state).toMatchObject({baseRevision: 1, dirty: true, card: {title: '저장한 제목', description: '저장 도중 입력'}});
  await editor.save(); await editor.open(card.id);
  expect(editor.state).toMatchObject({baseRevision: 2, dirty: false});
  expect(await repo.getBuffer(card.id)).toBeNull();
});

it('keeps editable text after an explicit save failure and allows retry', async () => {
  const {repo, card, editor} = await setup(); await editor.open(card.id);
  editor.edit({title: '재시도할 제목'}); await editor.flush();
  vi.spyOn(repo, 'saveCard').mockRejectedValueOnce(new Error('write failed'));
  await expect(editor.save()).rejects.toThrow('write failed');
  expect(editor.state).toMatchObject({dirty: true, card: {title: '재시도할 제목'}});
  await editor.save();
  expect(await repo.getCard(card.id)).toMatchObject({title: '재시도할 제목', revision: 1});
});

it('discards old history refreshes and keeps refreshed metadata when selecting an old row', async () => {
  const {repo, card, history} = await setup();
  const old = await repo.createConversation(card.id, '이전 제목');
  const gate = deferred(); const entered = deferred(); const read = repo.conversations.bind(repo);
  vi.spyOn(repo, 'conversations').mockImplementationOnce(async () => {const rows = await read(); entered.resolve(); await gate.promise; return rows;});
  const earlier = history.refresh(); await entered.promise;
  await repo.renameConversation(old.id, '새 제목'); await history.refresh();
  gate.resolve(); await earlier; history.select(old);
  expect(history.selected?.title).toBe('새 제목');
});

it('keeps a newly chosen room when deletion finishes, even if the reload fails', async () => {
  const {repo, card} = await setup();
  const first = await repo.createConversation(card.id, '삭제');
  const keep = await repo.createConversation(card.id, '유지');
  const gate = deferred();
  const history = new ConversationList(repo, async ids => {await gate.promise; await repo.deleteConversations(ids);});
  await history.refresh(); history.select(first);
  const removing = history.remove([first.id]); history.select(keep);
  vi.spyOn(repo, 'conversations').mockRejectedValueOnce(new Error('reload failed'));
  gate.resolve(); await expect(removing).rejects.toThrow('reload failed');
  expect(history.selected?.id).toBe(keep.id);
  expect(history.items.map(item => item.id)).toEqual([keep.id]);
  expect(history.select(first)).toBe(false);
  await history.refresh(); expect(history.selected?.id).toBe(keep.id);
});

it('preserves selection on failed deletion and chooses a surviving room on successful deletion', async () => {
  const {repo, card} = await setup();
  const first = await repo.createConversation(card.id); const keep = await repo.createConversation(card.id);
  const remove = vi.fn().mockRejectedValueOnce(new Error('delete failed')).mockImplementation((ids: string[]) => repo.deleteConversations(ids));
  const history = new ConversationList(repo, remove); await history.refresh(); history.select(first);
  await expect(history.remove([first.id])).rejects.toThrow('delete failed');
  expect(history.selected?.id).toBe(first.id); expect(history.items).toHaveLength(2);
  await history.remove([first.id]); expect(history.selected?.id).toBe(keep.id);
});

it('coalesces duplicate create requests and permits a subsequent explicit new room', async () => {
  const {repo, card, history} = await setup();
  const [first, repeated] = await Promise.all([history.roomFor(card.id, true), history.roomFor(card.id, true)]);
  expect(first.id).toBe(repeated.id);
  expect((await history.roomFor(card.id, true)).id).not.toBe(first.id);
  expect(await repo.conversations(card.id)).toHaveLength(2);
});

it('an old notice timeout cannot clear a repeated notice or a newer error', () => {
  const messages = new Notifications();
  messages.inform('저장했어요.'); const oldId = messages.snapshot().noticeId;
  messages.inform('저장했어요.'); const newId = messages.snapshot().noticeId;
  messages.report(new Error('연결 실패'));
  messages.dismissNotice(oldId);
  expect(messages.snapshot()).toMatchObject({notice: '저장했어요.', error: '연결 실패'});
  messages.dismissNotice(newId);
  expect(messages.snapshot()).toMatchObject({notice: null, error: '연결 실패'});
});

it('buffers edits made on the still-visible card while the next card is loading', async () => {
  const {repo, card, editor} = await setup(); await editor.open(card.id);
  const other = await repo.insertCard({...newCard(), title: '다음 카드'});
  const entered = deferred(); const release = deferred(); const read = repo.getCard.bind(repo);
  vi.spyOn(repo, 'getCard').mockImplementationOnce(async id => {entered.resolve(); await release.promise; return read(id);});
  const opening = editor.open(other.id); await entered.promise;
  editor.edit({description: '화면 전환을 기다리며 쓴 내용'});
  release.resolve(); await opening;
  expect(editor.state?.card.id).toBe(other.id);
  expect(await repo.getBuffer(card.id)).toMatchObject({card: {description: '화면 전환을 기다리며 쓴 내용'}});
  await editor.open(card.id);
  expect(editor.state?.card.description).toBe('화면 전환을 기다리며 쓴 내용');
});
