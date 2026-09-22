// @vitest-environment jsdom
import {act, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import {repository} from './helpers';
import {newCard} from '../src/features/cards/model';
import {SqliteExtensionStore} from '../src/adapters/sqlite/extensionStore';
import {SummaryExtensions} from '../src/extensions/SummaryExtensions';
import {SummaryExtensionSettings} from '../src/extensions/SummaryExtensionSettings';
import {ChatSummaryAction} from '../src/extensions/ChatSummaryAction';
import {GenerationCoordinator} from '../src/features/chat/generation';
import {summaryCapabilities} from '../src/extensions/summaryProgram';
import type {AiProvider} from '../src/ports/ai';

vi.mock('react-native', () => ({View: ({children}: {children?: ReactNode}) => <div>{children}</div>, Text: ({children}: {children?: ReactNode}) => <span>{children}</span>, ActivityIndicator: () => <span>진행 중</span>, Keyboard: {dismiss() {}}}));
vi.mock('../src/features/appearance/AppAppearance', () => ({useAppearance: () => ({colors: {text: '#111', header: '#fff'}, settings: {text: '#111', secondary: '#555'}})}));
vi.mock('../src/features/settings/SettingsLayout', () => ({
  useSettingsScale: () => 1,
  SettingsGroup: ({children}: {children: ReactNode}) => <div>{children}</div>,
  SettingsNote: ({children}: {children: ReactNode}) => <p>{children}</p>,
  SettingsRow: ({label, onPress}: {label: string; onPress: () => void}) => <button onClick={onPress}>{label}</button>,
  SettingsSheet: ({title, children, onClose}: {title: string; children: (close: () => void) => ReactNode; onClose: () => void}) => <div role="dialog"><h2>{title}</h2>{children(onClose)}<button onClick={onClose}>요약 닫기</button></div>,
}));
vi.mock('../src/features/settings/SettingsSubtitle', () => ({SettingsSubtitle: ({children}: {children: ReactNode}) => <h3>{children}</h3>}));
vi.mock('../src/features/settings/SettingsTextField', () => ({SettingsTextField: ({label, value, onChange}: {label: string; value: string; onChange: (value: string) => void}) => <textarea aria-label={label} value={value} onChange={event => onChange(event.target.value)}/>}));
vi.mock('../src/features/settings/AiSettingsControls', () => ({
  AiAction: ({label, onPress, disabled}: {label: string; onPress: () => void; disabled?: boolean}) => <button disabled={disabled} onClick={onPress}>{label}</button>,
  AiToggle: ({label, value, onChange}: {label: string; value: boolean; onChange: (value: boolean) => void}) => <button role="switch" aria-checked={value} onClick={() => onChange(!value)}>{label}</button>,
}));
vi.mock('../src/features/chat/DrawerGestureBoundary', () => ({useDrawerModalLock() {}}));
vi.mock('../src/layout/PressSurface', () => ({PressSurface: ({children, onPress, accessibilityLabel}: {children: ReactNode; onPress: () => void; accessibilityLabel: string}) => <button aria-label={accessibilityLabel} onClick={onPress}>{children}</button>}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

it('connects the real generate, review, activate, chat action, disable and restore flows', async () => {
  const repo = await repository(); const store = new SqliteExtensionStore(repo.db);
  let version = 0;
  const provider: AiProvider = {id: 'fixture', label: 'fixture', connected: true, research: false, inputCharacterLimit: 24000, async *stream(request) {
    const content = request.context.includes('JSON Schema:') ? JSON.stringify({schemaVersion: 1, id: 'personal.chat-summary', name: `요약 ${++version}`, description: '현재 방 요약', requestedCapabilities: [...summaryCapabilities], action: {location: 'chat.header', label: version === 1 ? '대화 요약' : '핵심 요약'}, steps: [{type: 'readConversation', limit: 80}, {type: 'generate', instruction: '요약해 주세요'}, {type: 'saveSummary'}]}) : '이 방의 저장된 요약';
    yield {type: 'delta', text: content}; yield {type: 'done'};
  }};
  const service = new SummaryExtensions(store, repo, new GenerationCoordinator(provider)); await service.load();
  const card = await repo.insertCard(newCard()); const room = await repo.createConversation(card.id); await repo.appendLocalUserMessage(room.id, '이야기 시작');
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const find = (label: string) => [...container.querySelectorAll('button')].find(button => (button.getAttribute('aria-label') ?? button.textContent) === label);
  const click = async (label: string) => {await act(async () => {expect(find(label)).toBeDefined(); find(label)!.click();});};
  const wait = async (check: () => void) => {await vi.waitFor(async () => {await act(async () => {}); check();});};
  try {
    await act(async () => root.render(<><SummaryExtensionSettings extensions={service}/><ChatSummaryAction extensions={service} conversationId={room.id} width={412} top={100} hidden={false} onHeight={() => {}}/></>));
    await click('AI로 만들기'); await wait(() => expect(find('권한 허용하고 적용')).toBeDefined());
    expect(find('대화 요약')).toBeUndefined();
    await click('예제 대화로 미리보기'); await wait(() => expect(container.textContent).toContain('실제 대화에는 저장되지 않아요'));
    expect(await store.results(room.id)).toHaveLength(0);
    await click('권한 허용하고 적용'); await wait(() => expect(find('대화 요약')).toBeDefined());
    await click('대화 요약'); await wait(() => expect(container.querySelector('[role="dialog"]')?.textContent).toContain('이 방의 저장된 요약'));
    expect(await store.results(room.id)).toHaveLength(1);
    await click('요약 닫기');
    await click('요약 버튼 사용'); await wait(() => expect(find('대화 요약')).toBeUndefined());
    await click('이 버전으로 복원'); await wait(() => expect(find('대화 요약')).toBeDefined());
    await click('AI로 새 버전 만들기'); await wait(() => expect(find('권한 허용하고 적용')).toBeDefined());
    expect(find('대화 요약')).toBeDefined(); expect(find('핵심 요약')).toBeUndefined();
    await click('권한 허용하고 적용'); await wait(() => expect(find('핵심 요약')).toBeDefined());
    await click('v1 · 요약 1'); await click('이 버전으로 복원'); await wait(() => expect(find('대화 요약')).toBeDefined());
    expect(await store.results(room.id)).toHaveLength(1);
  } finally {await act(async () => root.unmount()); container.remove(); await repo.db.close();}
});
