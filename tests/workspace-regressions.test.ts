import {afterEach, expect, it, vi} from 'vitest';
import {repository} from './helpers';
import {Workspace} from '../src/app/workspace';
import {newCard, type Card, type Draft} from '../src/features/cards/model';
import {CreationService} from '../src/features/chat/service';
import {GenerationCoordinator} from '../src/features/chat/generation';
import {DisconnectedProvider} from '../src/adapters/ai/disconnected';
import type {SqlDatabase} from '../src/ports/storage';

const opened: SqlDatabase[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const db of opened.splice(0)) await db.close();
});

async function setup() {
  const repo = await repository();
  opened.push(repo.db);
  const provider = new DisconnectedProvider();
  const creation = new CreationService(repo, new GenerationCoordinator(provider));
  const workspace = new Workspace({repo, provider, creation});
  const card = await repo.insertCard(newCard());
  await workspace.ready();
  return {repo, workspace, card};
}

function draftFor(card: Card): Draft {
  return {
    id: `draft-${card.id}`, cardId: card.id, baseRevision: card.revision,
    kind: 'writing', status: 'completed', instruction: '세계관 초안', content: '새 세계관',
    sources: [], error: null, createdAt: Date.now(),
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {resolve = done;});
  return {promise, resolve};
}

it('reads the selected conversation title from the refreshed conversation list', async () => {
  const {repo, workspace, card} = await setup();
  await workspace.startChat(card, true);
  const id = workspace.history.selected!.id;
  await repo.appendLocalUserMessage(id, '첫 메시지로 정한 제목');
  await workspace.refresh();

  expect(workspace.history.selected?.title).toBe('첫 메시지로 정한 제목');
  expect(workspace.history.selected).toBe(workspace.history.items.find(item => item.id === id));
});

it('does not restore stale metadata when opening an older conversation reference', async () => {
  const {repo, workspace, card} = await setup();
  const stale = await repo.createConversation(card.id);
  await repo.appendLocalUserMessage(stale.id, '최신 제목');
  await workspace.refresh();
  await workspace.openConversation(stale);

  expect(workspace.history.selected?.title).toBe('최신 제목');
});

it('preserves edits made while applying a draft and rebases them onto the saved draft', async () => {
  const {repo, workspace, card} = await setup();
  await workspace.open(card.id);
  const stored = deferred();
  const release = deferred();
  const apply = repo.applyDraft.bind(repo);
  vi.spyOn(repo, 'applyDraft').mockImplementation(async (...args) => {
    const saved = await apply(...args);
    stored.resolve();
    await release.promise;
    return saved;
  });

  const pending = workspace.cardEditor.apply(draftFor(card), '적용한 세계관', 'world');
  await stored.promise;
  workspace.cardEditor.edit({description: '기다리는 동안 추가한 소개'});
  workspace.cardEditor.editWorld('era', '새로 입력한 시대');
  release.resolve();
  await pending;
  await workspace.cardEditor.flush();

  expect(workspace.cardEditor.state).toMatchObject({
    dirty: true, baseRevision: 1,
    card: {description: '기다리는 동안 추가한 소개', body: {data: {world: '적용한 세계관', era: '새로 입력한 시대'}}},
  });
  expect(await repo.getBuffer(card.id)).toMatchObject({baseRevision: 1, card: {description: '기다리는 동안 추가한 소개'}});
  await workspace.open(card.id);
  await workspace.cardEditor.save();
  expect(await repo.getCard(card.id)).toMatchObject({revision: 2, description: '기다리는 동안 추가한 소개', body: {data: {world: '적용한 세계관', era: '새로 입력한 시대'}}});
});

it('keeps newer edits to the same field when draft application finishes', async () => {
  const {repo, workspace, card} = await setup();
  await workspace.open(card.id);
  const stored = deferred();
  const release = deferred();
  const apply = repo.applyDraft.bind(repo);
  vi.spyOn(repo, 'applyDraft').mockImplementation(async (...args) => {
    const saved = await apply(...args);
    stored.resolve();
    await release.promise;
    return saved;
  });
  const pending = workspace.cardEditor.apply(draftFor(card), '적용한 세계관', 'world');
  await stored.promise;
  workspace.cardEditor.editWorld('world', '사용자가 나중에 쓴 세계관');
  release.resolve();
  await pending;
  await workspace.cardEditor.flush();
  expect(workspace.cardEditor.state).toMatchObject({dirty: true, card: {body: {data: {world: '사용자가 나중에 쓴 세계관'}}}});
});

it('does not replace another card editor when an earlier draft application completes', async () => {
  const {repo, workspace, card} = await setup();
  const other = await repo.insertCard({...newCard(), title: '다른 카드'});
  await workspace.open(card.id);
  const stored = deferred();
  const release = deferred();
  const apply = repo.applyDraft.bind(repo);
  vi.spyOn(repo, 'applyDraft').mockImplementation(async (...args) => {
    const saved = await apply(...args);
    stored.resolve();
    await release.promise;
    return saved;
  });
  const pending = workspace.cardEditor.apply(draftFor(card), '적용한 세계관', 'world');
  await stored.promise;
  await workspace.open(other.id);
  workspace.cardEditor.edit({description: '다른 카드에서 작성 중'});
  release.resolve();
  await pending;
  await workspace.cardEditor.flush();
  expect(workspace.cardEditor.state).toMatchObject({dirty: true, card: {id: other.id, description: '다른 카드에서 작성 중'}});
  expect(await repo.getBuffer(other.id)).toMatchObject({card: {description: '다른 카드에서 작성 중'}});
});


it('does not navigate to a card whose slow load finishes after opening a chat', async () => {
  const {repo, workspace, card} = await setup();
  const chat = await repo.createConversation(card.id);
  const gate = deferred(); const entered = deferred(); const get = repo.getCard.bind(repo);
  vi.spyOn(repo, 'getCard').mockImplementationOnce(async id => {entered.resolve(); await gate.promise; return get(id);});
  const opening = workspace.open(card.id); await entered.promise;
  await workspace.openConversation(chat); gate.resolve(); await opening;
  expect(workspace.page).toBe('chat'); expect(workspace.history.selected?.id).toBe(chat.id);
  expect(workspace.cardEditor.state).toBeNull();
});

it('does not switch back when an earlier new-room request completes after choosing another room', async () => {
  const {repo, workspace, card} = await setup();
  const keep = await repo.createConversation(card.id, '사용자가 나중에 연 방');
  const gate = deferred(); const entered = deferred(); const create = repo.createConversation.bind(repo);
  vi.spyOn(repo, 'createConversation').mockImplementationOnce(async (...args) => {entered.resolve(); await gate.promise; return create(...args);});
  const opening = workspace.startChat(card, true); await entered.promise;
  await workspace.openConversation(keep); gate.resolve(); await opening;
  expect(workspace.history.selected?.id).toBe(keep.id); expect(workspace.page).toBe('chat');
});

it('archiving a card cannot close an editor opened while its write was pending', async () => {
  const {repo, workspace, card} = await setup();
  const other = await repo.insertCard({...newCard(), title: '다른 카드'});
  await workspace.open(card.id);
  const gate = deferred(); const entered = deferred(); const update = repo.updateMetadata.bind(repo);
  vi.spyOn(repo, 'updateMetadata').mockImplementationOnce(async (...args) => {entered.resolve(); await gate.promise; return update(...args);});
  const archiving = workspace.archive(card); await entered.promise;
  await workspace.open(other.id); gate.resolve(); await archiving;
  expect(workspace.page).toBe('editor'); expect(workspace.cardEditor.state?.card.id).toBe(other.id);
  expect((await repo.getCard(card.id)).archived).toBe(true);
});
