// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {repository} from './helpers';
import type {Repository} from '../src/adapters/sqlite/repository';
import {CardEditor} from '../src/features/cards/CardEditor';
import {AssistantPanel} from '../src/features/cards/AssistantPanel';
import {newCard, type Card, type Draft} from '../src/features/cards/model';
import {CreationService} from '../src/features/chat/service';
import {GenerationCoordinator} from '../src/features/chat/generation';
import {DisconnectedProvider} from '../src/adapters/ai/disconnected';

vi.mock('react-native', () => vi.importActual('react-native-web'));

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let repo: Repository;
afterEach(async () => {if (root) await act(async () => root!.unmount()); root = undefined; vi.restoreAllMocks(); if (repo) await repo.db.close(); document.body.replaceChildren();});
function draft(card: Card, content: string): Draft {
  return {id: `draft-${card.id}`, cardId: card.id, baseRevision: card.revision, content, kind: 'writing', status: 'completed', instruction: '초안을 써 주세요', sources: [], error: null, createdAt: Date.now()};
}
async function setup() {
  repo = await repository();
  const first = await repo.insertCard(newCard()); const second = await repo.insertCard(newCard());
  await repo.putDraft(draft(first, '첫 번째 카드의 초안')); await repo.putDraft(draft(second, '두 번째 카드의 초안'));
  const report = vi.fn();
  const editor = new CardEditor(repo, {report, committed: async () => {}});
  await editor.open(first.id);
  const creation = new CreationService(repo, new GenerationCoordinator(new DisconnectedProvider()));
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  return {first, second, editor, report, render: () => act(async () => root!.render(<AssistantPanel session={editor} creation={creation} connected={false} openSettings={async () => {}} report={report}/>))};
}
function output() {return document.querySelector<HTMLTextAreaElement>('[aria-label="생성된 초안 편집"]');}

it('does not copy the old card draft into the next card while its history loads', async () => {
  const {second, editor, render} = await setup(); await render();
  await vi.waitFor(() => expect(output()?.value).toBe('첫 번째 카드의 초안'));
  let release!: () => void; const gate = new Promise<void>(resolve => {release = resolve;});
  const read = repo.drafts.bind(repo);
  vi.spyOn(repo, 'drafts').mockImplementation(async id => {if (id === second.id) await gate; return read(id);});
  await act(async () => {await editor.open(second.id);});
  expect(output()).toBeNull(); expect(editor.assistantForm(second.id).content).toBe('');
  await act(async () => {release();});
  await vi.waitFor(() => expect(output()?.value).toBe('두 번째 카드의 초안'));
  await act(async () => {editor.close(second.id);});
  expect(document.querySelector('textarea')).toBeNull();
});

it('ignores a draft read failure after the card editor closes', async () => {
  const {first, editor, report, render} = await setup();
  let reject!: (error: Error) => void;
  vi.spyOn(repo, 'drafts').mockImplementationOnce(() => new Promise((_, fail) => {reject = fail;}));
  await render(); await act(async () => {editor.close(first.id);});
  await act(async () => {reject(new Error('late read failure'));});
  expect(report).not.toHaveBeenCalled();
});
