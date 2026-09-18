import {afterEach, expect, it, vi} from 'vitest';
import {repository} from './helpers';
import {Workspace} from '../src/app/workspace';
import {newCard} from '../src/features/cards/model';
import {CreationService} from '../src/features/chat/service';
import {GenerationCoordinator} from '../src/features/chat/generation';
import {DisconnectedProvider} from '../src/adapters/ai/disconnected';
import type {SqlDatabase} from '../src/ports/storage';

const opened: SqlDatabase[] = [];
afterEach(async () => {vi.restoreAllMocks(); for (const db of opened.splice(0)) await db.close();});

it('preserves edits made during a pending save, including after reopening the editor', async () => {
  const repo = await repository(); opened.push(repo.db);
  const provider = new DisconnectedProvider();
  const workspace = new Workspace({repo, provider, creation: new CreationService(repo, new GenerationCoordinator(provider))});
  const card = await repo.insertCard(newCard()); await workspace.ready(); await workspace.open(card.id);
  workspace.edit({title: '저장 중인 제목'});
  const originalSave = repo.saveCard.bind(repo);
  let finish!: () => void;
  const gate = new Promise<void>(resolve => {finish = resolve;});
  const save = vi.spyOn(repo, 'saveCard').mockImplementation(async (...args) => {await gate; return originalSave(...args);});
  const first = workspace.save(); const duplicateClick = workspace.save();
  workspace.edit({description: '저장이 끝나기 전에 추가한 문장'}); await workspace.flush();
  finish(); await Promise.all([first, duplicateClick]);
  expect(save).toHaveBeenCalledTimes(1);
  expect((await repo.getCard(card.id)).description).toBe('');
  expect(await repo.getBuffer(card.id)).toMatchObject({baseRevision: 1, card: {description: '저장이 끝나기 전에 추가한 문장'}});
  await workspace.open(card.id); await workspace.save();
  expect(await repo.getCard(card.id)).toMatchObject({revision: 2, description: '저장이 끝나기 전에 추가한 문장'});
});
