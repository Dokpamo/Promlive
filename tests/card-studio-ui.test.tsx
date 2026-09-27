// @vitest-environment jsdom
import {act, useEffect, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {CardStudioScreen} from '../src/features/authoring/CardStudioScreen';
import {AuthoringSession} from '../src/features/authoring/AuthoringSession';
import {AuthoringAssistant} from '../src/features/authoring/AuthoringAssistant';
import {SqliteAuthoringStore} from '../src/adapters/sqlite/authoringStore';
import {GenerationCoordinator} from '../src/features/chat/generation';
import {fieldValue} from '../src/features/authoring/model';
import {newCard} from '../src/features/cards/model';
import {getExperience} from '../src/features/cards/experience';
import {StudioPocket} from '../src/features/authoring/StudioPocket';
import {SceneControls} from '../src/features/cards/SceneControls';
import {initialScene} from '../src/features/cards/experience';
import {repository, FixtureProvider} from './helpers';
import type {Repository} from '../src/adapters/sqlite/repository';

const dismissals = vi.hoisted(() => ({defer: false, finish: [] as Array<() => void>}));

vi.mock('react-native', async () => ({...await vi.importActual<typeof import('react-native')>('react-native-web'),
  useWindowDimensions: () => ({width: 412, height: 892, fontScale: 1, scale: 1}),
  AccessibilityInfo: {isReduceMotionEnabled: async () => true, addEventListener: () => ({remove() {}})},
}));
vi.mock('react-native-safe-area-context', () => ({useSafeAreaInsets: () => ({top: 24, right: 0, bottom: 24, left: 0})}));
vi.mock('../src/layout/KeyboardMotion', () => ({useKeyboardFrame: () => ({height: 0}), KeyboardDock: ({children}: {children: ReactNode}) => <div>{children}</div>, KeyboardMotionProvider: ({children}: {children: ReactNode}) => <div>{children}</div>}));
vi.mock('../src/layout/SwipeBackModal', () => ({
  useSheetDrag: () => undefined,
  SwipeBackScrollContent: ({children}: {children: ReactNode}) => <div>{children}</div>,
  SwipeBackBoundary: ({children}: {children: ReactNode}) => <div>{children}</div>,
  SwipeBackModal: ({children, dismiss, onClose, onShow, onDismissStart}: {children: (close: () => void, motion: object, begin: () => void) => ReactNode; dismiss?: boolean; onClose: () => void; onShow?: () => void; onDismissStart?: () => void}) => {
    useEffect(() => onShow?.(), []);
    useEffect(() => {if (dismiss) onClose();}, [dismiss]);
    return <div>{children(() => {onDismissStart?.(); if (dismissals.defer) dismissals.finish.push(onClose); else onClose();}, {}, () => onDismissStart?.())}</div>;
  },
}));
vi.mock('../src/features/chat/ChatComposer', () => ({ChatComposer: ({value, onChange, onSend, onCancel, action}: {value: string; onChange: (text: string) => void; onSend: () => void; onCancel: () => void; action: {kind: string; label: string; enabled: boolean}}) => <><input aria-label="제작 요청" value={value} onChange={e => onChange(e.target.value)}/><button disabled={!action.enabled} onClick={action.kind === 'cancel' ? onCancel : onSend}>{action.label}</button></>}));
vi.mock('../src/features/chat/ChatScreen', () => ({ChatScreen: ({header}: {header: ReactNode}) => <div>{header}</div>}));
vi.mock('../src/adapters/profile/importCardImage', () => ({importCardImage: async () => null}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined, session: AuthoringSession | undefined, repo: Repository | undefined;
async function press(label: string) {
  const target = document.querySelector(`[aria-label="${label}"]`) ?? [...document.querySelectorAll('button')].find(button => button.textContent === label);
  expect(target, label).toBeTruthy(); await act(async () => (target as HTMLElement).click());
}
async function enter(input: HTMLInputElement, value: string) {
  await act(async () => {Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', {bubbles: true}));});
}
async function mount() {
  repo = await repository(); const card = await repo.insertCard({...newCard(), studioDraft: true});
  const store = new SqliteAuthoringStore(repo.db);
  const provider = new FixtureProvider(async function* () {yield {type: 'delta', text: JSON.stringify({kind: 'change', message: '', changes: [{field: 'characterName', value: '서린'}]})}; yield {type: 'done'};});
  session = new AuthoringSession(card.id, store, new AuthoringAssistant(new GenerationCoordinator(provider))); await session.load();
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  const published = vi.fn(async () => {}), startChat = vi.fn(async () => {});
  await act(async () => root!.render(<CardStudioScreen session={session!} onClose={async () => {}} onPublished={published} startChat={startChat} openSettings={() => {}}/>));
  return {store, card, published, startChat};
}
afterEach(async () => {
  dismissals.defer = false; dismissals.finish.length = 0;
  if (root) await act(async () => root!.unmount()); root = undefined;
  await session?.close(); session = undefined; await repo?.db.close(); repo = undefined;
  document.body.replaceChildren();
});

it('exposes actual generated fields for immediate editing and retains that edit across views', async () => {
  const {store, card} = await mount();
  await enter(document.querySelector('[aria-label="제작 요청"]')!, '사서를 만들어 줘'); await press('AI에 제작 요청');
  expect(document.body.textContent).toContain('서린');
  await press('이름');
  expect(session!.snapshot().focusedField).toBe('characterName');
  await enter(document.querySelector('[data-testid="settings-mini-text-editor"] input')!, '하린');
  await press('입력 완료'); expect(session!.snapshot().focusedField).toBeNull();
  await press('직접 편집'); expect(document.body.textContent).toContain('하린');
  await press('AI와 만들기'); expect(document.body.textContent).toContain('하린');
  await act(async () => session!.flush());
  expect(fieldValue((await store.open(card.id)).project.draft, 'characterName')).toBe('하린');
});

it('publishes explicitly, creates an isolated test, and starts a real chat only when requested', async () => {
  const {published, startChat, card} = await mount();
  await act(async () => session!.setField('title', '직접 만든 카드'));
  await press('직접 편집'); await press('대화 시험'); expect(document.querySelector('[data-testid="card-studio-preview"]')).toBeTruthy();
  expect(await repo!.conversations()).toHaveLength(0); expect(startChat).not.toHaveBeenCalled();
  await press('제작으로 돌아가기'); await press('카드로 사용');
  expect(published).toHaveBeenCalledTimes(1); expect((await repo!.getCard(card.id)).studioDraft).toBe(false);
  await press('새 대화 시작'); expect(startChat).toHaveBeenCalledWith(expect.objectContaining({title: '직접 만든 카드', publishedVersion: expect.any(String)}), undefined);
});

it('creates independent places with prompt, asset and activation controls', async () => {
  await mount(); await press('직접 편집'); await press('장소 추가');
  expect(session!.snapshot().project!.draft.experience!.resources.filter(r => r.kind === 'place')).toHaveLength(1);
  expect(document.querySelector('[aria-label="프롬프트"]')).toBeTruthy();
  expect(document.querySelector('[aria-label="이미지 추가"]')).toBeTruthy();
  expect(document.querySelector('[aria-label="음원·파일 추가"]')).toBeTruthy();
  await press('상태 조건 추가');
  expect(session!.snapshot().project!.draft.experience!.resources.find(r => r.kind === 'place')!.activation.conditions).toEqual([{key: '상태', operator: 'is', value: '열림'}]);
});

it('offers multiple named starts with their own place, participants and initial state', async () => {
  await mount(); await press('직접 편집'); await press('시작 상황 추가');
  expect(session!.snapshot().project!.draft.experience!.starts).toHaveLength(2);
  expect(document.querySelector('[aria-label="시작 프롬프트"]')).toBeTruthy();
  expect(document.body.textContent).toContain('처음 활성화할 인물');
  await press('상태값 추가');
  expect(session!.snapshot().project!.draft.experience!.starts[1]!.flags).toEqual({'상태1': ''});
});

it('finishes closing the start picker before opening a preview and does not reopen it on return', async () => {
  await mount();
  const experience = getExperience(session!.snapshot().project!.draft);
  experience.starts.push({...experience.starts[0]!, id: 'second-start', name: '다른 시작'});
  await act(async () => session!.setField('structure', JSON.stringify(experience)));
  await press('직접 편집'); await press('대화 시험');
  dismissals.defer = true;
  await act(async () => (document.querySelector('[role="radio"][aria-label="다른 시작"]') as HTMLElement).click());
  expect(document.querySelector('[data-testid="card-studio-preview"]')).toBeNull();
  expect(dismissals.finish).toHaveLength(1);
  await act(async () => dismissals.finish.shift()!());
  expect(document.querySelector('[data-testid="card-studio-preview"]')).toBeTruthy();
  await press('제작으로 돌아가기');
  expect(document.body.textContent).not.toContain('어디서 시작할까요?');
});

it('uses a user bubble and bare assistant text in the creation conversation', async () => {
  await mount(); await enter(document.querySelector('[aria-label="제작 요청"]')!, '사서를 만들어 줘'); await press('AI에 제작 요청');
  const [user, assistant] = session!.snapshot().project!.messages;
  const userSurface = document.querySelector(`[data-testid="message-surface-${user!.id}"]`)!;
  const assistantSurface = document.querySelector(`[data-testid="message-surface-${assistant!.id}"]`)!;
  expect(getComputedStyle(userSurface).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(getComputedStyle(assistantSurface).backgroundColor).toBe('rgba(0, 0, 0, 0)');
});

it('edits pocket templates without replacing the creation draft and renders scene values', async () => {
  await mount();
  const experience = getExperience(session!.snapshot().project!.draft);
  experience.starts[0]!.flags = {'체력': '100'};
  await act(async () => session!.setField('structure', JSON.stringify(experience)));
  const close = vi.fn();
  await act(async () => root!.render(<StudioPocket session={session!} close={close}/>));
  expect(document.body.textContent).toContain('체력'); expect(document.body.textContent).toContain('100');
  await press('상태창 편집'); await press('목록형');
  expect(session!.snapshot().project!.draft.pocket!.template).toBe('list');
  await press('상태 항목 추가');
  expect(session!.snapshot().project!.draft.pocket!.fields).toHaveLength(4);
  await press('선택창 닫기'); await press('포켓에서 돌아가기'); expect(close).toHaveBeenCalledOnce();
  expect(session!.snapshot().project!.draft.experience!.starts[0]!.flags).toEqual({'체력': '100'});
});

it('shows the intro separately from the authored first message', async () => {
  await mount(); const card = session!.snapshot().project!.draft;
  const experience = getExperience(card);
  experience.starts[0]!.intro = {kind: 'text', text: '눈으로 보는 도입'};
  experience.starts[0]!.greeting = 'AI에게 전달되는 첫 메시지';
  await act(async () => root!.render(<SceneControls store={{getConversationCard: async () => ({...card, experience}), getSceneState: async () => initialScene(experience), setSceneState: async () => {}}} roomId="test" scale={1} report={() => {}}/>));
  expect(document.querySelector('[data-testid="card-intro"]')!.textContent).toBe('눈으로 보는 도입');
  expect(document.body.textContent).not.toContain('AI에게 전달되는 첫 메시지');
});
