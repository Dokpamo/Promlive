// @vitest-environment jsdom
import {act, useSyncExternalStore} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {ChatDrawer} from '../src/features/chat/ChatDrawer';
import {Workspace} from '../src/app/workspace';
import {SqliteAuthoringStore} from '../src/adapters/sqlite/authoringStore';
import {CreationService} from '../src/features/chat/service';
import {GenerationCoordinator} from '../src/features/chat/generation';
import {newCard, type Card} from '../src/features/cards/model';
import type {CardListActions} from '../src/features/cards/store';
import type {Repository} from '../src/adapters/sqlite/repository';
import {FixtureProvider, repository} from './helpers';

vi.mock('react-native', async () => ({...await vi.importActual<typeof import('react-native')>('react-native-web'),
  useWindowDimensions: () => ({width: 412, height: 892, fontScale: 1, scale: 1}),
  AccessibilityInfo: {isReduceMotionEnabled: async () => true, addEventListener: () => ({remove() {}})},
}));
vi.mock('react-native-safe-area-context', () => ({useSafeAreaInsets: () => ({top: 24, right: 0, bottom: 24, left: 0})}));
// Keep the real drawer, panel state, workspace and persistence. Only the list
// presentation is replaced so clicks can exercise the navigation contract.
vi.mock('../src/features/chat/ChatHistory', () => ({ChatHistory: ({cards, cardActions, selectedCardId, openCard}: {
  cards: readonly Card[]; cardActions: CardListActions; selectedCardId?: string; openCard: (card: Card) => void;
}) => <div>{cards.map(card => <div key={card.id}>
  <button aria-label={card.title} aria-pressed={selectedCardId === card.id} onClick={() => openCard(card)}>{card.title}</button>
  <button aria-label={`편집 ${card.title}`} onClick={() => void cardActions.edit?.(card.id)}>편집</button>
</div>)}</div>}));
vi.mock('../src/features/chat/CardConversationPanel', () => ({CardConversationPanel: () => <div data-testid="history-contents"/>}));

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined, repo: Repository | undefined, workspace: Workspace | undefined;
afterEach(async () => {
  if (root) await act(async () => root!.unmount()); root = undefined;
  await workspace?.studio?.close(); workspace = undefined;
  await repo?.db.close(); repo = undefined;
  document.body.replaceChildren();
});

function Host({w}: {w: Workspace}) {
  useSyncExternalStore(w.subscribe, w.snapshot);
  return <ChatDrawer cardItems={w.cards} cardActions={w.cardActions} historyList={w.history} startChat={card => w.startChat(card!)}
    openConversation={room => w.openConversation(room)} report={w.notifications.report} openSettings={() => {}}
    studioOpen={w.page === 'editor'} studioId={w.studio?.cardId}>
    {open => <button aria-label="목록 열기" onClick={open}>목록 열기</button>}
  </ChatDrawer>;
}
async function setup() {
  repo = await repository();
  const provider = new FixtureProvider();
  workspace = new Workspace({repo, provider, creation: new CreationService(repo, new GenerationCoordinator(provider)), authoring: new SqliteAuthoringStore(repo.db)});
  const draft = await repo.insertCard({...newCard(), title: '제작 중인 카드', studioDraft: true});
  const completed = await repo.insertCard({...newCard(), title: '완성된 카드'});
  await workspace.ready(); await workspace.openStudio(draft.id);
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<Host w={workspace!}/>));
  return {w: workspace, draft, completed};
}
async function press(label: string) {
  const button = document.querySelector(`[aria-label="${label}"]`) as HTMLElement;
  expect(button).toBeTruthy(); await act(async () => button.click());
}
const drawerOpen = () => !!document.querySelector('[data-testid="chat-drawer-close"]');

it('returns to the current studio on repeated card and edit clicks while retaining its session and draft', async () => {
  const {w, draft} = await setup(), original = w.studio!;
  await act(async () => original.setPrompt('아직 보내지 않은 제작 요청'));
  for (const label of [draft.title, draft.title, `편집 ${draft.title}`]) {
    await press('목록 열기'); expect(drawerOpen()).toBe(true);
    await press(label);
    expect(drawerOpen()).toBe(false);
    expect(w.studio).toBe(original);
    expect(w.studio!.snapshot().project!.prompt).toBe('아직 보내지 않은 제작 요청');
    expect(document.querySelector(`[aria-label="${draft.title}"]`)!.getAttribute('aria-pressed')).toBe('true');
  }
});

it('still opens conversation history when a completed card is selected', async () => {
  const {w, completed} = await setup(), original = w.studio;
  await press('목록 열기'); await press(completed.title);
  expect(document.querySelector('[data-testid="history-contents"]')).toBeTruthy();
  expect(drawerOpen()).toBe(true); expect(w.studio).toBe(original);
});
