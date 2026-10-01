// @vitest-environment jsdom
import {act, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import App from '../App';
import {ScreenMemory} from '../src/ui/ScreenMemory';
import {createSettingsServices, SettingsServicesProvider, type SettingsServices} from '../src/ui/settings/SettingsServices';
import {ThemeProvider, useTheme} from '../src/ui/Theme';
import {aiPreferencesKey} from '../src/features/settings/aiSettingsPreferences';
vi.mock('../src/ui/screenStorage', () => import('../src/ui/screenStorage.web'));
vi.mock('../src/ui/chat-input/InputField', () => import('../src/ui/chat-input/InputField.web'));
vi.mock('../src/adapters/profile/pickProfileImage', () => ({pickProfileImage: async () => null}));
vi.mock('../src/adapters/profile/cropProfileImage', () => ({cropProfileImage: async () => ''}));
vi.mock('react-native', async () => {
  const native = await vi.importActual<typeof import('react-native')>('react-native-web');
  return {...native, AccessibilityInfo: {...native.AccessibilityInfo, isReduceMotionEnabled: async () => true},
    useWindowDimensions: () => ({width: 412, height: 892, fontScale: 1, scale: 1})};
});
vi.mock('react-native-safe-area-context', () => ({SafeAreaProvider: ({children}: {children: ReactNode}) => <>{children}</>, useSafeAreaInsets: () => ({top: 24, right: 0, bottom: 24, left: 0})}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(async () => {if (root) await act(async () => root!.unmount()); root = undefined; document.body.replaceChildren(); vi.restoreAllMocks();});
const visible = (selector: string) => [...document.querySelectorAll(selector)].filter(el => !el.closest('[aria-hidden="true"]'));
const get = (id: string) => visible(`[data-testid="${id}"]`)[0] as HTMLElement;
async function click(id: string) {expect(get(id), id).toBeTruthy(); await act(async () => get(id).click());}
async function button(label: string) {
  const el = visible('[role="button"]').find(el => el.getAttribute('aria-label') === label) as HTMLElement;
  expect(el, label).toBeTruthy(); await act(async () => el.click());
}
async function type(id: string, value: string) {
  const el = get(id) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', {bubbles: true}));
  });
}
async function fixture() {
  const values = new Map<string, string>(), secrets = new Map<string, string>();
  const repo = {getSetting: async (key: string) => values.get(key), setSetting: async (key: string, value: string) => {values.set(key, value);}};
  const credentials = {get: async (key: string) => secrets.get(key) ?? null, set: async (key: string, value: string) => {secrets.set(key, value);}, remove: async (key: string) => {secrets.delete(key);}};
  const services = createSettingsServices(repo, credentials); await services.load();
  const memory = new ScreenMemory({readSync: () => null, readBackupSync: () => null, read: async () => null, write: async () => {}});
  memory.updateView(view => ({...view, tab: 'settings'}));
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const render = async (settings: SettingsServices) => {await act(async () => root!.render(<App memory={memory} settingsServices={settings}/>));};
  await render(services);
  return {services, repo, credentials, values, secrets, render, container, memory};
}
it('opens full pages, renders only back/visibility icons in AI details, and stores keys outside ordinary preferences', async () => {
  const {services, values, secrets, repo, credentials} = await fixture();
  await click('ui-settings-row-ai');
  expect(visible('[role="dialog"]')).toHaveLength(0);
  expect(get('ui-tab-bar')).toBeUndefined();
  expect(visible('[data-testid="ui-ai-settings"] img')).toHaveLength(2);
  const input = get('ui-ai-api-key') as HTMLInputElement;
  expect(input.type).toBe('password');
  await type('ui-ai-api-key', 'test-only-not-a-real-api-key');
  await click('ui-api-key-visibility'); expect(input.type).toBe('text');
  await click('ui-api-key-visibility'); expect(input.type).toBe('password');
  await act(() => services.ai.flush());
  expect([...secrets.values()]).toContain('test-only-not-a-real-api-key');
  expect(values.get(aiPreferencesKey)).not.toContain('test-only-not-a-real-api-key');
  await click('ui-ai-provider'); await click('ui-choice-google');
  expect((get('ui-ai-api-key') as HTMLInputElement).value).toBe('');
  await click('ui-ai-provider'); await click('ui-choice-xai');
  expect((get('ui-ai-api-key') as HTMLInputElement).value).toBe('test-only-not-a-real-api-key');
  await act(() => services.ai.flush());
  const restarted = createSettingsServices(repo, credentials); await restarted.load();
  expect(restarted.ai.snapshot().value.connections.xai.key).toBe('test-only-not-a-real-api-key');
});
it('keeps model settings isolated and preserves the page and scroll while choosing', async () => {
  const {services} = await fixture();
  await click('ui-settings-row-ai');
  const page = get('ui-ai-settings'), scroll = get('ui-settings-detail-content'); scroll.scrollTop = 225;
  await type('ui-ai-maxTokens', '2500');
  await click('ui-ai-tool-web');
  expect(get('ui-ai-tool-web').getAttribute('aria-checked')).toBe('true');
  const original = services.ai.snapshot().value.connections.xai.model;
  await click('ui-ai-model');
  const other = visible('[data-testid^="ui-model-"]').find(el => el.getAttribute('data-testid') !== `ui-model-${original}` && el.getAttribute('role') === 'button') as HTMLElement;
  expect(other).toBeTruthy(); await act(async () => other.click());
  expect(get('ui-ai-settings')).toBe(page); expect(scroll.scrollTop).toBe(225);
  expect((get('ui-ai-maxTokens') as HTMLInputElement).value).toBe('10000');
  await click('ui-ai-model'); await click(`ui-model-${original}`);
  expect((get('ui-ai-maxTokens') as HTMLInputElement).value).toBe('2500');
  expect(get('ui-ai-tool-web').getAttribute('aria-checked')).toBe('true');
  await click('ui-ai-route'); await click('ui-choice-oauth');
  expect(get('ui-ai-api-key')).toBeUndefined();
  await click('ui-ai-route'); await click('ui-choice-api');
  expect((get('ui-ai-maxTokens') as HTMLInputElement).value).toBe('2500');
});
it('creates, edits, duplicates, searches and moves personas using the existing persisted collection', async () => {
  const {services, repo, credentials} = await fixture();
  await click('ui-settings-row-personas'); await button('추가');
  await type('ui-persona-name', '도서관 방문자'); await type('ui-persona-description', '별을 좋아하는 여행자'); await click('ui-persona-save');
  const id = services.personas.snapshot().value.items.find(item => item.name === '도서관 방문자')!.id;
  await click(`ui-persona-${id}`); await type('ui-persona-description', '별을 기록하는 여행자'); await click('ui-persona-save');
  await click(`ui-persona-${id}`); await button('복제');
  expect(services.personas.snapshot().value.items.some(item => item.name === '도서관 방문자 사본')).toBe(true);
  await button('폴더 만들기'); await type('ui-persona-folder-name', '여행'); await button('완료');
  const folder = services.personas.snapshot().value.folders[0]!;
  await button('관리'); await click(`ui-persona-${id}`); await button('이동'); await click(`ui-choice-${folder.id}`);
  expect(services.personas.snapshot().value.items.find(item => item.id === id)?.folderId).toBe(folder.id);
  await type('ui-persona-search', '기록하는'); expect(get(`ui-persona-${id}`)).toBeTruthy();
  const reopened = createSettingsServices(repo, credentials); await reopened.load();
  expect(reopened.personas.snapshot().value.items.find(item => item.id === id)?.description).toBe('별을 기록하는 여행자');
  expect(reopened.personas.snapshot().value.items.find(item => item.id === id)?.folderId).toBe(folder.id);
});
it('applies the shared dark palette to settings, library, chips and chat when returning from theme selection', async () => {
  const {services, values} = await fixture();
  await click('ui-settings-row-theme'); await click('ui-theme-mode'); await click('ui-choice-dark');
  expect(get('ui-settings-theme').style.backgroundColor).toBe('rgb(16, 16, 16)');
  await click('ui-settings-back'); await click('ui-tab-library');
  expect(getComputedStyle(get('ui-library-grid')).backgroundColor).toBe('rgb(16, 16, 16)');
  expect(get('ui-tab-bar').style.backgroundColor).toBe('rgb(16, 16, 16)');
  await click('ui-tab-chats'); await click('ui-chat-row-night-library');
  expect(getComputedStyle(get('ui-chat-room')).backgroundColor).toBe('rgb(16, 16, 16)');
  expect(get('ui-chat-composer').style.backgroundColor).toBe('rgb(30, 30, 30)');
  await act(() => services.general.flush()); expect(values.get('appearance:theme')).toBe('dark');
});
it('uses the system back action to cancel a choice without changing its value', async () => {
  const {services} = await fixture();
  await click('ui-settings-row-ai'); await click('ui-ai-provider');
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})));
  expect(get('ui-ai-settings')).toBeTruthy(); expect(services.ai.snapshot().value.service).toBe('xai');
  await click('ui-settings-back'); expect(get('ui-tab-bar')).toBeTruthy();
});
it('paints the cached theme while storage is loading, then reconciles the saved preference', async () => {
  let finish!: () => void;
  const gate = new Promise<void>(resolve => {finish = resolve;});
  const repo = {getSetting: async (key: string) => {await gate; return key === 'appearance:theme' ? 'light' : undefined;}, setSetting: async () => {}};
  const services = createSettingsServices(repo, {get: async () => null, set: async () => {}, remove: async () => {}});
  const memory = new ScreenMemory({readSync: () => null, readBackupSync: () => null, read: async () => null, write: async () => {}});
  memory.updateView(view => ({...view, themeMode: 'dark'}));
  function Probe() {return <span data-testid="theme-probe">{useTheme().appearance}</span>;}
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<SettingsServicesProvider services={services}><ThemeProvider memory={memory}><Probe/></ThemeProvider></SettingsServicesProvider>));
  expect(get('theme-probe').textContent).toBe('dark');
  await act(async () => {finish(); await services.load();});
  expect(get('theme-probe').textContent).toBe('light');
  expect(memory.getSnapshot().view.themeMode).toBe('light');
});
