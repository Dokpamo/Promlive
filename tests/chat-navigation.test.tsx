// @vitest-environment jsdom
import {act, useSyncExternalStore} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import type {GestureResponderEvent, PanResponderCallbacks, PanResponderGestureState} from 'react-native';
import {ChatNavigation} from '../src/features/chat/ChatNavigation';
import {Workspace} from '../src/app/workspace';
import {SqliteAuthoringStore} from '../src/adapters/sqlite/authoringStore';
import {CreationService} from '../src/features/chat/service';
import {GenerationCoordinator} from '../src/features/chat/generation';
import {newCard} from '../src/features/cards/model';
import type {Repository} from '../src/adapters/sqlite/repository';
import {FixtureProvider, repository} from './helpers';

const responder = vi.hoisted(() => ({current: null as PanResponderCallbacks | null}));
vi.mock('react-native', async () => ({...await vi.importActual<typeof import('react-native')>('react-native-web'),
  useWindowDimensions: () => ({width: 412, height: 892, fontScale: 1, scale: 1}),
  AccessibilityInfo: {isReduceMotionEnabled: async () => true, addEventListener: () => ({remove() {}})},
  PanResponder: {create: (callbacks: PanResponderCallbacks) => {responder.current = callbacks; return {panHandlers: {}};}},
}));
vi.mock('../src/layout/useScreenCorners', () => ({useScreenCorners: () => ({topLeft: 24, topRight: 24, bottomLeft: 24, bottomRight: 24})}));

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined, repo: Repository | undefined, workspace: Workspace | undefined;
const report = vi.fn();
let exit: Promise<void> | undefined;
afterEach(async () => {
  if (root) await act(async () => root!.unmount()); root = undefined;
  await workspace?.studio?.close(); workspace = undefined;
  await repo?.db.close(); repo = undefined;
  exit = undefined; report.mockClear(); vi.restoreAllMocks(); document.body.replaceChildren();
});

function Host({w, active = true}: {w: Workspace; active?: boolean}) {
  useSyncExternalStore(w.subscribe, w.snapshot);
  return <><div data-testid="collection">새 생성 목록</div>{w.studio && <ChatNavigation routeKey={w.studio.cardId} active={active}
    onExit={() => (exit = w.closeStudio('library'))} report={report}
    pocketContent={close => <button aria-label="포켓 닫기" onClick={close}>포켓</button>}>
    {navigation => <><button aria-label="목록으로 돌아가기" onClick={navigation.close}>돌아가기</button><button aria-label="포켓 열기" onClick={navigation.openPocket}>포켓 열기</button></>}
  </ChatNavigation>}</>;
}
async function setup() {
  repo = await repository();
  const provider = new FixtureProvider();
  workspace = new Workspace({repo, provider, creation: new CreationService(repo, new GenerationCoordinator(provider)), authoring: new SqliteAuthoringStore(repo.db)});
  const draft = await repo.insertCard({...newCard(), title: '제작 중인 카드', studioDraft: true});
  await workspace.ready(); await workspace.openStudio(draft.id);
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<Host w={workspace!}/>));
  return {w: workspace, draft};
}
async function press(label: string) {
  const button = document.querySelector(`[aria-label="${label}"]`) as HTMLElement;
  expect(button).toBeTruthy(); await act(async () => button.click());
  await act(async () => {await exit?.catch(() => {});});
}
async function swipe(dx: number, dy = 0, vx = 0) {
  const p = responder.current!, event = {} as GestureResponderEvent;
  const gesture = (x: number, y: number, velocity = 0) => ({dx: x, dy: y, vx: velocity, numberActiveTouches: 1} as PanResponderGestureState);
  await act(async () => {
    p.onStartShouldSetPanResponderCapture?.(event, gesture(0, 0));
    if (!p.onMoveShouldSetPanResponderCapture?.(event, gesture(Math.sign(dx) * 12, Math.sign(dy) * 12))) return;
    p.onPanResponderGrant?.(event, gesture(12, 0));
    p.onPanResponderMove?.(event, gesture(dx, dy, vx));
    p.onPanResponderRelease?.(event, gesture(dx, dy, vx));
  });
  await act(async () => {await exit?.catch(() => {});});
}
const pocketOpen = () => !!document.querySelector('[data-testid="pocket-page"]');

it('returns directly to the new collection and persists the unfinished studio prompt', async () => {
  const {w, draft} = await setup();
  await act(async () => w.studio!.setPrompt('아직 보내지 않은 제작 요청'));
  await press('목록으로 돌아가기');
  expect(w.page).toBe('library'); expect(w.studio).toBeNull();
  expect(document.querySelector('[data-testid="chat-navigation"]')).toBeNull();
  expect(document.querySelector('[data-testid="card-list-page"]')).toBeNull();
  await act(async () => w.openStudio(draft.id));
  expect(w.studio!.snapshot().project!.prompt).toBe('아직 보내지 않은 제작 요청');
});

it('opens the pocket to the left, closes only that layer to the right, then returns to the collection', async () => {
  const {w} = await setup(), original = w.studio;
  await swipe(-280, 0, -.7); expect(pocketOpen()).toBe(true);
  await swipe(700, 0, .7); expect(pocketOpen()).toBe(false);
  expect(w.studio).toBe(original); expect(exit).toBeUndefined();
  await swipe(280, 0, .7);
  expect(w.page).toBe('library'); expect(w.studio).toBeNull();
  expect(document.querySelector('[data-testid="card-list-page"]')).toBeNull();
});

it('keeps a short return swipe and vertical scrolling inside the current room', async () => {
  const {w} = await setup(), original = w.studio;
  await swipe(50); expect(w.studio).toBe(original); expect(exit).toBeUndefined();
  await swipe(15, 250); expect(w.studio).toBe(original); expect(exit).toBeUndefined();
  await press('포켓 열기'); expect(pocketOpen()).toBe(true);
  await press('포켓 닫기'); expect(pocketOpen()).toBe(false); expect(w.studio).toBe(original);
});

it('does not navigate while an overlay covers the room', async () => {
  const {w} = await setup();
  await act(async () => root!.render(<Host w={w} active={false}/>));
  await swipe(300, 0, .7); await press('목록으로 돌아가기'); await press('포켓 열기');
  expect(exit).toBeUndefined(); expect(pocketOpen()).toBe(false); expect(w.page).toBe('editor');
});

it('keeps the draft open after a failed save and allows the return to be retried', async () => {
  const {w} = await setup(), original = w.studio!;
  vi.spyOn(original, 'close').mockRejectedValueOnce(new Error('disk full'));
  await press('목록으로 돌아가기');
  expect(w.studio).toBe(original); expect(w.page).toBe('editor');
  expect(report).toHaveBeenCalledWith(expect.objectContaining({message: 'disk full'}));
  await press('목록으로 돌아가기');
  expect(w.studio).toBeNull(); expect(w.page).toBe('library');
});
