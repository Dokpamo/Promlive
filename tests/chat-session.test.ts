import {afterEach, expect, it, vi} from 'vitest';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FixtureProvider, repository} from './helpers';
import {newCard} from '../src/features/cards/model';
import {ChatSession, composerAction} from '../src/features/chat/ChatSession';
import {CreationService} from '../src/features/chat/service';
import {GenerationCoordinator} from '../src/features/chat/generation';
import {DisconnectedProvider} from '../src/adapters/ai/disconnected';
import type {Repository} from '../src/adapters/sqlite/repository';

const opened: Repository[] = [];
const sessions: ChatSession[] = [];
afterEach(async () => {sessions.splice(0).forEach(session => session.dispose()); for (const repo of opened.splice(0)) await repo.db.close(); vi.restoreAllMocks();});
function deferred() {let resolve!: () => void; const promise = new Promise<void>(done => {resolve = done;}); return {promise, resolve};}
async function setup(provider = new DisconnectedProvider() as GenerationCoordinator['provider']) {
  const repo = await repository(); opened.push(repo);
  const card = await repo.insertCard(newCard()); const room = await repo.createConversation(card.id);
  const service = new CreationService(repo, new GenerationCoordinator(provider));
  const session = new ChatSession(room.id, card, repo, service, () => {}); sessions.push(session); await session.load();
  return {repo, room, session, service};
}

it('accepts one submission exactly once and rejects both stale draft writes and reused ids with different content', async () => {
  const {repo, room} = await setup();
  await repo.writeComposerDraft(room.id, {text: '보낼 내용', revision: 4});
  const submission = {id: 'stable-submission', conversationId: room.id, text: '보낼 내용', draftRevision: 4, generate: false};
  const accepted = await repo.acceptChatSubmission(submission);
  expect((await repo.acceptChatSubmission(submission)).user.id).toBe(accepted.user.id);
  expect((await repo.acceptChatSubmission(submission)).replayed).toBe(true);
  await repo.writeComposerDraft(room.id, {text: '지연된 저장', revision: 4});
  await repo.writeComposerDraft(room.id, {text: '더 오래된 저장', revision: 3});
  expect(await repo.loadComposerDraft(room.id)).toEqual({text: '', revision: 4, acceptedRevision: 4});
  await expect(repo.acceptChatSubmission({...submission, id: 'another-id'})).rejects.toThrow('이미 전송');
  await expect(repo.acceptChatSubmission({...submission, text: '다른 내용'})).rejects.toThrow('달라');
  expect(await repo.messages(room.id)).toHaveLength(1);
});

it('preserves a newer identical draft whether its write arrives before or after acceptance', async () => {
  const {repo, room} = await setup();
  await repo.writeComposerDraft(room.id, {text: '같은 문장', revision: 3});
  await repo.acceptChatSubmission({id: 'first', conversationId: room.id, text: '같은 문장', draftRevision: 1, generate: false});
  expect((await repo.loadComposerDraft(room.id)).text).toBe('같은 문장');
  await repo.acceptChatSubmission({id: 'second', conversationId: room.id, text: '같은 문장', draftRevision: 3, generate: false});
  await repo.writeComposerDraft(room.id, {text: '같은 문장', revision: 4});
  expect(await repo.loadComposerDraft(room.id)).toEqual({text: '같은 문장', revision: 4, acceptedRevision: 3});
});

it('rolls back message insertion and draft clearing together on storage failure', async () => {
  const {repo, room} = await setup();
  await repo.writeComposerDraft(room.id, {text: '보존할 초안', revision: 1});
  await repo.db.execute("CREATE TRIGGER fail_submission BEFORE INSERT ON chat_submissions BEGIN SELECT RAISE(ABORT,'disk failure'); END");
  await expect(repo.acceptChatSubmission({id: 'failed', conversationId: room.id, text: '보존할 초안', draftRevision: 1, generate: true})).rejects.toThrow('disk failure');
  expect(await repo.messages(room.id)).toEqual([]);
  expect(await repo.loadComposerDraft(room.id)).toEqual({text: '보존할 초안', revision: 1, acceptedRevision: -1});
});

it('finishes a detached room send and keeps the next edit while rejecting double sends', async () => {
  const {repo, room, session} = await setup();
  const hold = deferred(); const accept = repo.acceptChatSubmission.bind(repo);
  vi.spyOn(repo, 'acceptChatSubmission').mockImplementationOnce(async input => {await hold.promise; return accept(input);});
  session.change('전송할 문장');
  const first = session.send(); const duplicate = session.send();
  expect(duplicate).toBe(first);
  session.change('전송 중 새 편집'); await session.flush();
  hold.resolve(); await first;
  expect(session.snapshot().draft.text).toBe('전송 중 새 편집');
  expect((await repo.loadComposerDraft(room.id)).text).toBe('전송 중 새 편집');
  expect(await repo.messages(room.id)).toHaveLength(1);
});

it('allows immediate cancellation while the send promise is still streaming', async () => {
  const hold = deferred();
  const provider = new FixtureProvider(async function* () {yield {type: 'delta', text: '부분 응답'}; await hold.promise; yield {type: 'done'};});
  const {repo, room, session} = await setup(provider);
  session.change('질문'); const send = session.send();
  await vi.waitFor(() => expect(provider.signal).toBeDefined());
  expect(composerAction(session.snapshot())).toEqual({kind: 'cancel', enabled: true, label: '응답 중단'});
  session.cancel();
  expect(composerAction(session.snapshot()).enabled).toBe(false);
  await send; hold.resolve();
  expect(provider.signal?.aborted).toBe(true);
  expect((await repo.messages(room.id))[1]).toMatchObject({content: '부분 응답', status: 'cancelled'});
});

it('preserves an accepted draft tombstone across process restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'promlive-submission-')); const file = join(dir, 'app.sqlite');
  let repo = await repository(file);
  try {
    const card = await repo.insertCard(newCard()); const room = await repo.createConversation(card.id);
    const submission = {id: 'persisted-submission', conversationId: room.id, text: '전송', draftRevision: 2, generate: false};
    await repo.acceptChatSubmission(submission); await repo.db.close(); repo = await repository(file);
    await repo.writeComposerDraft(room.id, {text: '전송', revision: 2});
    expect((await repo.loadComposerDraft(room.id)).text).toBe('');
    expect((await repo.acceptChatSubmission(submission)).replayed).toBe(true);
    expect(await repo.messages(room.id)).toHaveLength(1);
  } finally {await repo.db.close(); rmSync(dir, {recursive: true, force: true});}
});
