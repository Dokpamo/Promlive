// @vitest-environment jsdom
import {act, useSyncExternalStore, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {FixtureProvider, repository} from './helpers';
import {Workspace} from '../src/app/workspace';
import {newCard} from '../src/features/cards/model';
import {ChatScreen} from '../src/features/chat/ChatScreen';
import {CreationService} from '../src/features/chat/service';
import {GenerationCoordinator} from '../src/features/chat/generation';
import {DisconnectedProvider} from '../src/adapters/ai/disconnected';
import type {Message} from '../src/features/chat/model';
import type {Repository} from '../src/adapters/sqlite/repository';
import type {AiProvider} from '../src/ports/ai';

// Keep the real screen, effects, workspace, service and SQLite repository.
// Only native presentation widgets are replaced by DOM controls in this suite.
vi.mock('react-native', async () => {
  const React = await import('react');
  const View = ({children, testID}: {children?: ReactNode; testID?: string}) => <div data-testid={testID}>{children}</div>;
  return {
    View, Text: View, KeyboardAvoidingView: View,
    Platform: {OS: 'web'},
    Keyboard: {addListener: () => ({remove() {}})},
    Pressable: ({children, onPress, disabled}: {children: ReactNode; onPress: () => void; disabled?: boolean}) => <button disabled={disabled} onClick={onPress}>{children}</button>,
    FlatList: React.forwardRef((props: {data: Message[]; renderItem: (value: {item: Message}) => ReactNode; ListHeaderComponent: ReactNode}, ref) => {
      React.useImperativeHandle(ref, () => ({scrollToEnd() {}}));
      return <div>{props.ListHeaderComponent}{props.data.map(item => <div key={item.id} data-message-id={item.id}>{props.renderItem({item})}</div>)}</div>;
    }),
  };
});
vi.mock('react-native-safe-area-context', () => ({useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0})}));
vi.mock('../src/layout/KeyboardMotion', () => ({useKeyboardFrame: () => ({height: 0})}));
vi.mock('../src/features/appearance/AppAppearance', async () => {
  const {lightChatColors} = await import('../src/features/chat/chatAppearance');
  return {useAppearance: () => ({colors: lightChatColors, chatDisplay: 'default'})};
});
vi.mock('../src/features/chat/ChatComposer', () => ({
  ChatComposer: (props: {value: string; onChange: (value: string) => void; onSend: () => void; ready: boolean; sending: boolean}) => <>
    <textarea aria-label="메시지 입력" disabled={!props.ready} value={props.value} onChange={event => props.onChange(event.target.value)}/>
    <button disabled={!props.ready || props.sending} onClick={props.onSend}>전송</button>
  </>,
}));

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let repo: Repository | undefined;
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  vi.restoreAllMocks();
  if (repo) await repo.db.close();
  repo = undefined;
  document.body.replaceChildren();
});

function Host({workspace}: {workspace: Workspace}) {
  useSyncExternalStore(workspace.subscribe, workspace.snapshot);
  return <>
    <h1>{workspace.conversation?.title}</h1>
    <ChatScreen key={workspace.conversation?.id} workspace={workspace} width={412}/>
  </>;
}

async function setup(count = 0, provider: AiProvider = new DisconnectedProvider()) {
  const storage = await repository();
  repo = storage;
  const creation = new CreationService(storage, new GenerationCoordinator(provider));
  const workspace = new Workspace({repo: storage, provider, creation});
  const card = await storage.insertCard(newCard());
  const conversation = await storage.createConversation(card.id);
  for (let index = 1; index <= count; index++) await storage.appendLocalUserMessage(conversation.id, `기록 ${index}`);
  await workspace.ready();
  await workspace.openConversation(conversation);
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(<Host workspace={workspace}/>));
  await until(() => expect(input().disabled).toBe(false));
  return {workspace, storage, conversation};
}

function input() {return document.querySelector('textarea')!;}
function messages() {return Array.from(document.querySelectorAll('[data-message-id]'));}
function button(label: string) {return Array.from(document.querySelectorAll('button')).find(item => item.textContent === label);}
async function until(assertion: () => void | Promise<void>) {
  await vi.waitFor(async () => {await act(async () => {}); await assertion();});
}
async function type(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input(), value);
    input().dispatchEvent(new Event('input', {bubbles: true}));
  });
}
async function send(value: string) {
  await type(value);
  await act(async () => {button('전송')!.click();});
  await until(() => expect(input().value).toBe(''));
}

it('updates the header after sending without reloading a newer composer draft on metadata refresh', async () => {
  const {workspace, storage} = await setup();
  await send('첫 메시지 제목');
  await until(() => expect(document.querySelector('h1')?.textContent).toBe('첫 메시지 제목'));
  await type('아직 보내지 않은 문장');
  const reads = vi.spyOn(storage, 'getSetting');
  await act(async () => {await workspace.refresh();});
  expect(input().value).toBe('아직 보내지 않은 문장');
  expect(reads).not.toHaveBeenCalled();
});

it('keeps every message accessible after 41 consecutive sends in the same room', async () => {
  await setup();
  for (let index = 1; index <= 41; index++) await send(`새 메시지 ${index}`);
  await until(() => expect(messages()).toHaveLength(41));
  expect(messages()[0]?.textContent).toContain('새 메시지 1');
  expect(messages()[40]?.textContent).toContain('새 메시지 41');
});

it('keeps loaded older pages after sending and can still reach the beginning', async () => {
  const {storage, conversation} = await setup(90);
  expect(messages()).toHaveLength(40);
  await act(async () => {button('이전 대화 보기')!.click();});
  await until(() => expect(messages()).toHaveLength(80));
  await send('새로 보낸 메시지');
  await until(() => expect(messages()).toHaveLength(81));
  expect(messages()[0]?.textContent).toContain('기록 11');
  await act(async () => {button('이전 대화 보기')!.click();});
  await until(() => expect(messages()).toHaveLength(91));
  expect(button('이전 대화 보기')).toBeUndefined();
  expect(messages()[0]?.textContent).toContain('기록 1');
  expect(new Set(messages().map(item => item.getAttribute('data-message-id'))).size).toBe(91);
  expect(await storage.messages(conversation.id, undefined, 200)).toHaveLength(91);
});

it('keeps the input when sending fails', async () => {
  const {workspace, storage} = await setup();
  vi.spyOn(storage, 'appendLocalUserMessage').mockRejectedValueOnce(new Error('저장 실패'));
  await type('실패해도 남아야 하는 문장');
  await act(async () => {button('전송')!.click();});
  await until(() => expect(workspace.error).toBe('저장 실패'));
  expect(input().value).toBe('실패해도 남아야 하는 문장');
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {resolve = done;});
  return {promise, resolve};
}

it('preserves edits made while a send is being accepted, even if the text is retyped identically', async () => {
  const {storage, conversation} = await setup();
  const release = deferred();
  const append = storage.appendLocalUserMessage.bind(storage);
  vi.spyOn(storage, 'appendLocalUserMessage').mockImplementationOnce(async (...args) => {
    await release.promise;
    return append(...args);
  });
  await type('같은 문장');
  await act(async () => {button('전송')!.click();});
  await type('다시 편집');
  await type('같은 문장');
  await act(async () => {release.resolve();});
  await until(() => expect(messages()).toHaveLength(1));
  expect(input().value).toBe('같은 문장');
  await until(async () => expect(await storage.getSetting(`composer:${conversation.id}`)).toBe('같은 문장'));
});

it('flushes each room draft and ignores an earlier room send completing after navigation', async () => {
  const {workspace, storage, conversation} = await setup();
  const other = await storage.createConversation(conversation.cardId, '다른 방');
  await storage.setSetting(`composer:${other.id}`, '다른 방 초안');
  await act(async () => {await workspace.refresh();});
  const release = deferred();
  const append = storage.appendLocalUserMessage.bind(storage);
  vi.spyOn(storage, 'appendLocalUserMessage').mockImplementationOnce(async (...args) => {
    await release.promise;
    return append(...args);
  });
  await type('첫 방에서 보낸 문장');
  await act(async () => {button('전송')!.click();});
  await act(async () => {await workspace.openConversation(other);});
  await until(() => expect(input().value).toBe('다른 방 초안'));
  await type('다른 방에서 새로 편집');
  await act(async () => {release.resolve();});
  await until(async () => expect(await storage.messages(conversation.id)).toHaveLength(1));
  expect(input().value).toBe('다른 방에서 새로 편집');
  expect(document.querySelector('h1')?.textContent).toBe('다른 방');
  expect(messages()).toHaveLength(0);
  await act(async () => {await workspace.openConversation(conversation);});
  await until(() => expect(input().disabled).toBe(false));
  expect(await storage.getSetting(`composer:${other.id}`)).toBe('다른 방에서 새로 편집');
});

it('ignores a late draft restore after switching to another conversation', async () => {
  const {workspace, storage, conversation} = await setup();
  const slow = await storage.createConversation(conversation.cardId, '늦게 열리는 방');
  await type('현재 방 초안');
  await act(async () => {await workspace.refresh();});
  const release = deferred();
  const read = storage.getSetting.bind(storage);
  vi.spyOn(storage, 'getSetting').mockImplementation(async key => {
    if (key === `composer:${slow.id}`) {await release.promise; return '늦게 도착한 다른 방 초안';}
    return read(key);
  });
  await act(async () => {await workspace.openConversation(slow);});
  expect(input().disabled).toBe(true);
  await act(async () => {await workspace.openConversation(conversation);});
  await until(() => expect(input().disabled).toBe(false));
  expect(input().value).toBe('현재 방 초안');
  await type('돌아와서 작성한 문장');
  await act(async () => {release.resolve();});
  expect(input().value).toBe('돌아와서 작성한 문장');
});

it('updates the first-message title during streaming and keeps the final response without duplicates', async () => {
  const release = deferred();
  const provider = new FixtureProvider(async function* () {
    yield {type: 'delta', text: '응답 시작'};
    await release.promise;
    yield {type: 'delta', text: ' 완료'};
    yield {type: 'done'};
  });
  const {storage, conversation} = await setup(0, provider);
  await type('스트리밍 중에도 바뀔 제목');
  await act(async () => {button('전송')!.click();});
  await until(() => {
    expect(document.querySelector('h1')?.textContent).toBe('스트리밍 중에도 바뀔 제목');
    expect(messages()).toHaveLength(2);
    expect(messages()[1]?.textContent).toContain('응답 시작');
  });
  await type('응답을 기다리며 쓰는 문장');
  await act(async () => {release.resolve();});
  await until(async () => expect((await storage.messages(conversation.id))[1]?.status).toBe('completed'));
  expect(messages()).toHaveLength(2);
  expect(messages()[1]?.textContent).toContain('응답 시작 완료');
  expect(input().value).toBe('응답을 기다리며 쓰는 문장');
});
