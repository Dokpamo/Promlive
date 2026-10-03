// @vitest-environment jsdom
import './ui-image-fixtures';
import {act, StrictMode, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {AccessibilityInfo, Animated} from 'react-native';
import {afterEach, expect, it, vi} from 'vitest';
import App from '../App';
import {ScreenMemory} from '../src/ui/ScreenMemory';
import {createSettingsServices, SettingsServicesProvider, type SettingsServices} from '../src/ui/settings/SettingsServices';
import {ThemeProvider, useTheme} from '../src/ui/Theme';
import {aiPreferencesKey} from '../src/features/settings/aiSettingsPreferences';
import * as modelCatalog from '../src/features/settings/aiModelCatalog';
import {catalogScope} from '../src/features/settings/aiCatalogCache';
import {aiServices, type AiModelPreview} from '../src/features/settings/aiSettingsModel';
import {AnimatedModelRows} from '../src/ui/settings/AnimatedModelRows';
vi.mock('../src/ui/screenStorage', () => import('../src/ui/screenStorage.web'));
vi.mock('../src/ui/chat-input/InputField', () => import('../src/ui/chat-input/InputField.web'));
const photos = vi.hoisted(() => ({pick: vi.fn(), crop: vi.fn()}));
vi.mock('../src/adapters/profile/pickProfileImage', () => ({pickProfileImage: photos.pick}));
vi.mock('../src/adapters/profile/cropProfileImage', () => ({cropProfileImage: photos.crop}));
vi.mock('react-native', async () => {
  const native = await vi.importActual<typeof import('react-native')>('react-native-web');
  return {...native, AccessibilityInfo: {...native.AccessibilityInfo, isReduceMotionEnabled: async () => true},
    useWindowDimensions: () => ({width: 412, height: 892, fontScale: 1, scale: 1})};
});
vi.mock('react-native-safe-area-context', () => ({SafeAreaProvider: ({children}: {children: ReactNode}) => <>{children}</>, useSafeAreaInsets: () => ({top: 24, right: 0, bottom: 24, left: 0})}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(async () => {if (root) await act(async () => root!.unmount()); root = undefined; document.body.replaceChildren(); vi.restoreAllMocks(); photos.pick.mockReset(); photos.crop.mockReset();});
const visible = (selector: string) => [...document.querySelectorAll(selector)].filter(el => !el.closest('[aria-hidden="true"]'));
const get = (id: string) => visible(`[data-testid="${id}"]`)[0] as HTMLElement;
async function click(id: string) {expect(get(id), id).toBeTruthy(); await act(async () => get(id).click());}
async function longPress(id: string) {
  const target = get(id); expect(target, id).toBeTruthy();
  await act(async () => {
    target.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, button: 0, buttons: 1}));
    await new Promise(resolve => setTimeout(resolve, 650));
  });
  await act(async () => get(id).dispatchEvent(new MouseEvent('mouseup', {bubbles: true, button: 0, buttons: 0})));
}
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
async function controlledModelAnimations() {
  // RN Web's test mock completes parallel() immediately, even while its children are pending.
  const real = await vi.importActual<{default: {parallel: typeof Animated.parallel}}>(
    'react-native-web/dist/vendor/react-native/Animated/AnimatedImplementation',
  );
  vi.spyOn(Animated, 'parallel').mockImplementation(real.default.parallel);
  vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  const pending: Array<{delay: number; to: number; finish: () => void}> = [];
  vi.spyOn(Animated, 'timing').mockImplementation((value, config) => {
    let stopped = false;
    return {start: done => pending.push({delay: config.delay ?? 0, to: config.toValue as number, finish: () => {
      if (!stopped) (value as Animated.Value).setValue(config.toValue as number);
      done?.({finished: true});
    }}), stop: () => {stopped = true;}, reset: () => {}};
  });
  return pending;
}
async function fixture() {
  const values = new Map<string, string>(), secrets = new Map<string, string>();
  const repo = {getSetting: async (key: string) => values.get(key), setSetting: async (key: string, value: string) => {values.set(key, value);}};
  const credentials = {get: async (key: string) => secrets.get(key) ?? null, set: async (key: string, value: string) => {secrets.set(key, value);}, remove: async (key: string) => {secrets.delete(key);}};
  const services = createSettingsServices(repo, credentials); await services.load();
  const memory = new ScreenMemory({readSync: () => null, readBackupSync: () => null, read: async () => null, write: async () => {}, readViewSync: () => null, writeView: async () => {}});
  memory.updateView(view => ({...view, tab: 'settings'}));
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const render = async (settings: SettingsServices) => {await act(async () => root!.render(<App memory={memory} settingsServices={settings}/>));};
  await render(services);
  return {services, repo, credentials, values, secrets, render, container, memory};
}
it('offers persona retry without editable recovery defaults and restores the original collection', async () => {
  const {repo, credentials, values, render} = await fixture();
  values.set('personas:v1', '{broken');
  const services = createSettingsServices(repo, credentials);
  await services.load(); await render(services);
  const writes = vi.spyOn(repo, 'setSetting');
  await click('ui-settings-row-personas');
  expect(get('ui-personas-load-retry')).toBeTruthy();
  expect(get('ui-persona-add')).toBeUndefined();
  expect(get('ui-persona-default')).toBeUndefined();
  await click('ui-personas-load-retry');
  expect(writes).not.toHaveBeenCalled();
  expect(values.get('personas:v1')).toBe('{broken');
  values.set('personas:v1', JSON.stringify({version: 1, items: [{id: 'original', name: '원래 페르소나', description: '', image: null}]}));
  await click('ui-personas-load-retry');
  expect(get('ui-personas-load-retry')).toBeUndefined();
  expect(get('ui-persona-original')).toBeTruthy();
  expect(get('ui-persona-add')).toBeTruthy();
  expect(writes).not.toHaveBeenCalled();
});

it('ignores completion from a closed persona editor while another editor is open and keeps navigation usable', async () => {
  const {services} = await fixture();
  let finish!: () => void;
  const update = services.personas.update;
  vi.spyOn(services.personas, 'update').mockImplementationOnce(async (...args) => {
    await new Promise<void>(resolve => {finish = resolve;}); await update(...args);
  });
  await click('ui-settings-row-personas'); await click('ui-persona-default');
  await type('ui-persona-name', '늦게 저장된 이름'); await click('ui-persona-save');
  expect(finish).toBeTypeOf('function');
  await click('ui-settings-back'); await click('ui-persona-add');
  const editor = get('ui-persona-editor');
  await type('ui-persona-name', '새 페이지의 초안');
  await act(async () => {finish();});
  expect(services.personas.snapshot().value.items[0]!.name).toBe('늦게 저장된 이름');
  expect(get('ui-persona-editor')).toBe(editor);
  expect((get('ui-persona-name') as HTMLInputElement).value).toBe('새 페이지의 초안');
  await click('ui-settings-back'); await click('ui-persona-add');
  expect(get('ui-persona-editor')).toBeTruthy();
  await click('ui-settings-back'); await click('ui-settings-back');
  expect(get('ui-tab-bar')).toBeTruthy();
});

it('keeps settings navigation usable when deletion completes after its confirmation page was cancelled', async () => {
  const {services} = await fixture();
  let finish!: () => void;
  const remove = services.personas.removeMany;
  vi.spyOn(services.personas, 'removeMany').mockImplementationOnce(async (...args) => {
    await new Promise<void>(resolve => {finish = resolve;}); await remove(...args);
  });
  await click('ui-settings-row-personas'); await longPress('ui-persona-default');
  await button('삭제'); await button('삭제');
  expect(finish).toBeTypeOf('function');
  await button('취소');
  await act(async () => {finish();});
  expect(services.personas.snapshot().value.items).toEqual([]);
  await click('ui-persona-add');
  expect(get('ui-persona-editor')).toBeTruthy();
  await click('ui-settings-back'); await click('ui-settings-back');
  expect(get('ui-tab-bar')).toBeTruthy();
});
it('keeps the user row consistent and automatically saves the name without a profile completion action', async () => {
  const {services} = await fixture();
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3eoAAAAASUVORK5CYII=';
  await act(() => services.profile.save({name: '별 여행자', image}));
  const row = get('ui-settings-user');
  expect(row.textContent).toBe('사용자');
  expect(row.querySelector('img')?.getAttribute('src')).not.toBe(image);
  expect(get('ui-profile-name')).toBeUndefined();
  await click('ui-settings-user');
  expect((get('ui-profile-name') as HTMLInputElement).value).toBe('별 여행자');
  expect(get('ui-profile-settings').querySelector(`img[src="${image}"]`)).toBeTruthy();
  const actions = visible('[role="button"]').map(el => el.getAttribute('aria-label'));
  for (const label of ['완료', '사진 변경', '사진 제거']) expect(actions).not.toContain(label);
  await type('ui-profile-name', '달 여행자');
  expect(services.profile.snapshot().value.name).toBe('달 여행자');
  await click('ui-settings-back');
  expect(get('ui-settings-user').textContent).toBe('사용자');
  await click('ui-settings-user');
  expect((get('ui-profile-name') as HTMLInputElement).value).toBe('달 여행자');
});
it('keeps a failed name draft for retry and does not persist a blank name', async () => {
  const {services} = await fixture(); await click('ui-settings-user');
  vi.spyOn(services.profile, 'update').mockRejectedValueOnce(new Error('disk full'));
  await type('ui-profile-name', '별 여행자');
  expect((get('ui-profile-name') as HTMLInputElement).value).toBe('별 여행자');
  expect(services.profile.snapshot().value.name).toBe('사용자');
  await button('이름 저장 다시 시도');
  expect(services.profile.snapshot().value.name).toBe('별 여행자');
  await type('ui-profile-name', '');
  await click('ui-settings-back'); await click('ui-settings-user');
  expect((get('ui-profile-name') as HTMLInputElement).value).toBe('별 여행자');
});
it('opens a crop preview after picking and cancels without changing the saved photo', async () => {
  const {services} = await fixture(); await click('ui-settings-user');
  const original = services.profile.snapshot().value;
  photos.pick.mockResolvedValue({uri: 'file:///test-photo.jpg', width: 800, height: 1200});
  await click('ui-profile-photo-edit');
  expect(get('ui-profile-photo-editor')).toBeTruthy();
  expect(photos.crop).not.toHaveBeenCalled();
  expect(services.profile.snapshot().value).toEqual(original);
  // Photo drags are never interpreted as the settings page's swipe-to-go-back.
  const swipe = get('ui-back-swipe');
  for (const [type, x, buttons] of [['mousedown', 40, 1], ['mousemove', 180, 1], ['mousemove', 370, 1], ['mouseup', 370, 0]] as const) {
    await act(async () => swipe.dispatchEvent(new MouseEvent(type, {bubbles: true, clientX: x, clientY: 200, button: 0, buttons})));
  }
  expect(get('ui-profile-photo-editor')).toBeTruthy();
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})));
  expect(get('ui-profile-settings')).toBeTruthy();
  expect(services.profile.snapshot().value).toEqual(original);
  expect(photos.crop).not.toHaveBeenCalled();
});
it('ignores picker cancellation and a late picker result after leaving the profile', async () => {
  await fixture(); await click('ui-settings-user');
  photos.pick.mockResolvedValueOnce(null);
  await click('ui-profile-photo-edit');
  expect(get('ui-profile-settings')).toBeTruthy(); expect(get('ui-profile-photo-editor')).toBeUndefined();
  let resolve!: (photo: {uri: string; width: number; height: number}) => void;
  photos.pick.mockImplementationOnce(() => new Promise(done => {resolve = done;}));
  await click('ui-profile-photo-edit'); await click('ui-profile-photo-edit');
  expect(photos.pick).toHaveBeenCalledTimes(2);
  await click('ui-settings-back');
  await act(async () => resolve({uri: 'file:///late.jpg', width: 800, height: 600}));
  expect(get('ui-profile-photo-editor')).toBeUndefined(); expect(get('ui-tab-bar')).toBeTruthy();
});
it('opens full pages, separates keys, and restores xAI and Anthropic settings after switching and restarting', async () => {
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
  await type('ui-ai-maxTokens', '2500');
  await click('ui-ai-tool-web');
  const xai = structuredClone(services.ai.snapshot().value.connections.xai);
  await act(() => services.ai.flush());
  expect([...secrets.values()]).toContain('test-only-not-a-real-api-key');
  expect(values.get(aiPreferencesKey)).not.toContain('test-only-not-a-real-api-key');
  await click('ui-ai-provider'); await click('ui-choice-anthropic');
  expect(get('ui-settings-choice-page')).toBeTruthy();
  await click('ui-settings-back');
  expect((get('ui-ai-api-key') as HTMLInputElement).value).toBe('');
  await type('ui-ai-api-key', 'test-only-anthropic-key');
  await type('ui-ai-maxTokens', '8000');
  const anthropic = structuredClone(services.ai.snapshot().value.connections.anthropic);
  await click('ui-ai-provider'); await click('ui-choice-xai');
  await click('ui-settings-back');
  expect((get('ui-ai-api-key') as HTMLInputElement).value).toBe('test-only-not-a-real-api-key');
  expect((get('ui-ai-maxTokens') as HTMLInputElement).value).toBe('2,500');
  expect(get('ui-ai-tool-web').getAttribute('aria-checked')).toBe('true');
  expect(services.ai.snapshot().value.connections.xai).toEqual(xai);
  expect(services.ai.snapshot().value.connections.anthropic).toEqual(anthropic);
  await act(() => services.ai.flush());
  expect(values.get(aiPreferencesKey)).not.toContain('test-only-anthropic-key');
  const restarted = createSettingsServices(repo, credentials); await restarted.load();
  expect(restarted.ai.snapshot().value.service).toBe('xai');
  expect(restarted.ai.snapshot().value.connections.xai).toEqual(xai);
  expect(restarted.ai.snapshot().value.connections.anthropic).toEqual(anthropic);
});
it('groups the token count for display and keeps focused edits and persisted values free of separators', async () => {
  const {services, values} = await fixture();
  await click('ui-settings-row-ai');
  const input = get('ui-ai-maxTokens') as HTMLInputElement;
  expect(input.value).toBe('10,000');
  await act(async () => input.focus());
  expect(input.value).toBe('10000');
  await type('ui-ai-maxTokens', '');
  expect(input.value).toBe('');
  await type('ui-ai-maxTokens', '8,192');
  expect(input.value).toBe('8192');
  const connection = services.ai.snapshot().value.connections.xai;
  expect(connection.modelPresets[connection.model]?.maxTokens).toBe('8192');
  await act(async () => input.blur());
  expect(input.value).toBe('8,192');
  await services.ai.flush();
  const saved = JSON.parse(values.get(aiPreferencesKey)!);
  expect(saved.connections.xai.modelPresets[connection.model].maxTokens).toBe('8192');
});
it('keeps AI controls unavailable after a read failure and retries the persisted provider without overwriting it', async () => {
  const {services, repo, credentials, values, render} = await fixture();
  await act(async () => {
    services.ai.update(old => ({...old, service: 'anthropic'}));
    await services.ai.flush();
  });
  const original = values.get(aiPreferencesKey);
  let failing = true;
  vi.spyOn(repo, 'getSetting').mockImplementation(async key => {
    if (key === aiPreferencesKey && failing) throw new Error('temporary disk failure');
    return values.get(key);
  });
  const restarted = createSettingsServices(repo, credentials);
  const writes = vi.spyOn(repo, 'setSetting');
  await render(restarted);
  await click('ui-settings-row-ai');
  expect(get('ui-ai-load-retry')).toBeTruthy();
  expect(get('ui-ai-provider')).toBeUndefined();
  expect(get('ui-ai-api-key')).toBeUndefined();
  expect(writes).not.toHaveBeenCalled();
  expect(values.get(aiPreferencesKey)).toBe(original);
  failing = false;
  await click('ui-ai-load-retry');
  expect(get('ui-ai-load-retry')).toBeUndefined();
  expect(get('ui-ai-provider').textContent).toContain('Anthropic');
  expect(restarted.ai.snapshot().value.service).toBe('anthropic');
  expect(values.get(aiPreferencesKey)).toBe(original);
  expect(writes).not.toHaveBeenCalled();
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
  const modelPage = get('ui-model-selection'), modelScroll = get('ui-settings-detail-content');
  await type('ui-model-search', 'grok'); modelScroll.scrollTop = 150;
  const other = visible('[data-testid="ui-model-list"] [role="button"]').find(el => el.getAttribute('data-testid') !== `ui-model-${original}`) as HTMLElement;
  expect(other).toBeTruthy(); await act(async () => other.click());
  const otherModel = services.ai.snapshot().value.connections.xai.model;
  expect(otherModel).not.toBe(original);
  expect(get('ui-model-selection')).toBe(modelPage);
  expect(modelScroll.scrollTop).toBe(150);
  expect((get('ui-model-search') as HTMLInputElement).value).toBe('grok');
  expect(other.querySelectorAll('img')).toHaveLength(1);
  await click(`ui-model-${original}`);
  expect(services.ai.snapshot().value.connections.xai.model).toBe(original);
  expect(get(`ui-model-${original}`).querySelectorAll('img')).toHaveLength(1);
  expect(other.querySelector('img')).toBeNull();
  await click(`ui-model-${otherModel}`);
  expect(get('ui-model-selection')).toBe(modelPage);
  expect(modelScroll.scrollTop).toBe(150);
  await click('ui-settings-back');
  expect(get('ui-ai-settings')).toBe(page); expect(scroll.scrollTop).toBe(225);
  expect((get('ui-ai-maxTokens') as HTMLInputElement).value).toBe('10,000');
  await click('ui-ai-model'); await click(`ui-model-${original}`);
  await click('ui-settings-back');
  expect((get('ui-ai-maxTokens') as HTMLInputElement).value).toBe('2,500');
  expect(get('ui-ai-tool-web').getAttribute('aria-checked')).toBe('true');
  await click('ui-ai-route'); await click('ui-choice-oauth');
  await click('ui-settings-back');
  expect(get('ui-ai-api-key')).toBeUndefined();
  await click('ui-ai-route'); await click('ui-choice-api');
  await click('ui-settings-back');
  expect((get('ui-ai-maxTokens') as HTMLInputElement).value).toBe('2,500');
});
it('creates, edits, duplicates, searches and moves personas using the existing persisted collection', async () => {
  const {services, repo, credentials} = await fixture();
  await click('ui-settings-row-personas'); await click('ui-persona-add');
  await type('ui-persona-name', '도서관 방문자'); await type('ui-persona-description', '별을 좋아하는 여행자'); await click('ui-persona-save');
  const id = services.personas.snapshot().value.items.find(item => item.name === '도서관 방문자')!.id;
  await click(`ui-persona-${id}`); await type('ui-persona-description', '별을 기록하는 여행자'); await click('ui-persona-save');
  await click(`ui-persona-${id}`); await button('복제');
  expect(services.personas.snapshot().value.items.some(item => item.name === '도서관 방문자 사본')).toBe(true);
  await button('폴더 만들기'); await type('ui-persona-folder-name', '여행'); await button('완료');
  const folder = services.personas.snapshot().value.folders[0]!;
  await longPress(`ui-persona-${id}`); await button('이동'); await click(`ui-choice-${folder.id}`);
  expect(services.personas.snapshot().value.items.find(item => item.id === id)?.folderId).toBe(folder.id);
  expect(get('ui-settings-choice-page')).toBeTruthy();
  await click('ui-settings-back');
  await click('ui-persona-search-button'); await type('ui-persona-search', '기록하는'); expect(get(`ui-persona-${id}`)).toBeTruthy();
  const reopened = createSettingsServices(repo, credentials); await reopened.load();
  expect(reopened.personas.snapshot().value.items.find(item => item.id === id)?.description).toBe('별을 기록하는 여행자');
  expect(reopened.personas.snapshot().value.items.find(item => item.id === id)?.folderId).toBe(folder.id);
});
it('filters personas with one folder chip row and creates inside the selected nested folder without replacing the page', async () => {
  const {services} = await fixture();
  const parent = await act(() => services.personas.createFolder('여행'));
  const guide = await act(() => services.personas.create({name: '길잡이', description: '별을 따라가는 여행자', image: null}, parent.id));
  await click('ui-settings-row-personas');
  const page = get('ui-personas-settings');
  expect(get('ui-persona-add').querySelectorAll('img')).toHaveLength(1);
  expect(get('ui-persona-search')).toBeUndefined();
  expect(visible('[role="button"][aria-label="관리"]')).toHaveLength(0);
  const addFolder = get('ui-persona-folder-add');
  expect(addFolder.closest('[data-horizontal-scroll]')).toBe(get('ui-personas-filters'));
  expect(addFolder.parentElement!.lastElementChild).toBe(addFolder);
  await click(`ui-personas-filter-${parent.id}`);
  expect(get('ui-personas-settings')).toBe(page);
  expect(get('ui-persona-default')).toBeUndefined();
  expect(get(`ui-personas-filter-${parent.id}`).getAttribute('aria-pressed')).toBe('true');
  await button('폴더 만들기'); await type('ui-persona-folder-name', '별 관측'); await button('완료');
  const child = services.personas.snapshot().value.folders.find(folder => folder.name === '별 관측')!;
  expect(child.parentId).toBe(parent.id);
  const chip = get(`ui-personas-filter-${child.id}`);
  expect(chip.textContent).toBe('여행 / 별 관측');
  await click(`ui-personas-filter-${child.id}`);
  await click('ui-persona-add'); await type('ui-persona-name', '관측자'); await type('ui-persona-description', '별을 기록해요.'); await click('ui-persona-save');
  const created = services.personas.snapshot().value.items.find(persona => persona.name === '관측자')!;
  expect(created.folderId).toBe(child.id);
  expect(get('ui-personas-settings')).toBe(page);
  expect(get(`ui-persona-${created.id}`)).toBeTruthy();
  await click('ui-persona-search-button'); await type('ui-persona-search', '없는 검색');
  expect(get(`ui-persona-${created.id}`)).toBeUndefined();
  expect(get(`ui-personas-filter-${child.id}`)).toBe(chip);
  await type('ui-persona-search', '별'); await click('ui-personas-filter-all');
  expect(get(`ui-persona-${guide.id}`)).toBeTruthy();
  expect(get(`ui-persona-${created.id}`)).toBeTruthy();
  expect(get('ui-persona-default')).toBeUndefined();
  await click('ui-persona-search-back');
  expect(get('ui-persona-search')).toBeUndefined();
  expect(get('ui-persona-default')).toBeTruthy();
  expect(get(`ui-persona-${created.id}`)).toBeTruthy();
  await click('ui-settings-back'); expect(get('ui-tab-bar')).toBeTruthy();
}, 10000);
it('renames, moves and deletes folders through managed chips while preserving nested personas', async () => {
  const {services, repo, credentials} = await fixture();
  const parent = await act(() => services.personas.createFolder('여행'));
  const child = await act(() => services.personas.createFolder('별', [], parent.id));
  const destination = await act(() => services.personas.createFolder('보관'));
  const persona = await act(() => services.personas.create({name: '관측자', description: '', image: null}, child.id));
  await click('ui-settings-row-personas'); await longPress(`ui-personas-filter-${parent.id}`);
  expect(get(`ui-personas-filter-${parent.id}`).getAttribute('aria-checked')).toBe('true');
  await button('폴더 이름'); await type('ui-persona-folder-name', '탐험'); await button('완료');
  expect(get(`ui-personas-filter-${child.id}`).textContent).toBe('탐험 / 별');
  await click(`ui-personas-filter-${child.id}`); await button('이동');
  expect(get(`ui-choice-${parent.id}`)).toBeUndefined();
  expect(get(`ui-choice-${child.id}`)).toBeUndefined();
  await click(`ui-choice-${destination.id}`); await click('ui-settings-back');
  expect(services.personas.snapshot().value.folders.find(folder => folder.id === parent.id)?.parentId).toBe(destination.id);
  expect(get(`ui-personas-filter-${child.id}`).textContent).toBe('보관 / 탐험 / 별');
  await click(`ui-personas-filter-${child.id}`);
  expect(get(`ui-persona-${persona.id}`)).toBeTruthy();
  await longPress(`ui-personas-filter-${child.id}`); await button('삭제'); await button('삭제');
  expect(get(`ui-personas-filter-${child.id}`)).toBeUndefined();
  expect(get('ui-personas-filter-all').getAttribute('aria-pressed')).toBe('true');
  expect(get(`ui-persona-${persona.id}`)).toBeTruthy();
  const reopened = createSettingsServices(repo, credentials); await reopened.load();
  expect(reopened.personas.snapshot().value.items.find(item => item.id === persona.id)?.folderId).toBe(parent.id);
  expect(reopened.personas.snapshot().value.folders.some(folder => folder.id === child.id)).toBe(false);
}, 10000);
it('keeps horizontal folder drags on the persona page while body drags still go back', async () => {
  await fixture(); await click('ui-settings-row-personas');
  const page = get('ui-personas-settings');
  const drag = async (target: HTMLElement) => {
    for (const [type, x, buttons] of [['mousedown', 70, 1], ['mousemove', 120, 1], ['mousemove', 350, 1], ['mouseup', 350, 0]] as const) {
      await act(async () => {
        target.dispatchEvent(new MouseEvent(type, {bubbles: true, clientX: x, clientY: 150, button: 0, buttons}));
        await new Promise(resolve => setTimeout(resolve, 20));
      });
    }
  };
  await drag(get('ui-personas-filter-all'));
  expect(get('ui-personas-settings')).toBe(page);
  expect(get('ui-back-motion').style.transform).toBe('translateX(0px)');
  await drag(get('ui-back-swipe'));
  expect(get('ui-personas-settings')).toBeUndefined();
  expect(get('ui-tab-bar')).toBeTruthy();
});
it('applies the shared dark palette to settings, library, chips and chat when returning from theme selection', async () => {
  const {services, values} = await fixture();
  await click('ui-settings-row-theme'); await click('ui-theme-mode'); await click('ui-choice-dark');
  const choicePage = get('ui-settings-choice-page');
  expect(choicePage.style.backgroundColor).toBe('rgb(16, 16, 16)');
  await click('ui-choice-light');
  expect(get('ui-settings-choice-page')).toBe(choicePage);
  expect(get('ui-choice-light').querySelectorAll('img')).toHaveLength(1);
  await click('ui-choice-dark');
  expect(get('ui-settings-choice-page')).toBe(choicePage);
  await click('ui-settings-back');
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
it('keeps repeated choices on the same page and returns only after explicit back and its motion finish', async () => {
  const {services} = await fixture();
  await click('ui-settings-row-ai');
  const page = get('ui-ai-settings'), scroll = get('ui-settings-detail-content');
  scroll.scrollTop = 120;
  await click('ui-ai-provider');
  const choicePage = get('ui-settings-choice-page'), choiceScroll = get('ui-settings-detail-content');
  choiceScroll.scrollTop = 80;
  vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  const completions: Array<() => void> = [];
  const spring = vi.spyOn(Animated, 'spring').mockImplementation((_value, config) => {
    expect(config.toValue).toBe(412);
    return {start: done => {completions.push(() => done?.({finished: true}));}, stop: () => {}, reset: () => {}};
  });
  await click('ui-choice-anthropic');
  expect(services.ai.snapshot().value.service).toBe('anthropic');
  expect(page.isConnected).toBe(true);
  expect(page.querySelector('[data-testid="ui-ai-provider"]')?.getAttribute('aria-label')).toBe('프로바이더, Anthropic');
  expect(scroll.scrollTop).toBe(120);
  expect(get('ui-settings-choice-page')).toBe(choicePage);
  expect(get('ui-choice-anthropic').querySelectorAll('img')).toHaveLength(1);
  expect(get('ui-choice-xai').querySelector('img')).toBeNull();
  expect((document.querySelector('[data-testid="ui-settings-layer-0"]') as HTMLElement).style.opacity).toBe('1');

  await click('ui-choice-openai');
  expect(services.ai.snapshot().value.service).toBe('openai');
  expect(get('ui-settings-choice-page')).toBe(choicePage);
  expect(choiceScroll.scrollTop).toBe(80);
  expect(get('ui-choice-openai').querySelectorAll('img')).toHaveLength(1);
  expect(get('ui-choice-anthropic').querySelector('img')).toBeNull();
  expect(page.querySelector('[data-testid="ui-ai-provider"]')?.getAttribute('aria-label')).toBe('프로바이더, OpenAI');
  expect(spring).not.toHaveBeenCalled();

  // Explicit back animates once; a repeated system back must not pop two pages.
  await click('ui-settings-back');
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})));
  expect(services.ai.snapshot().value.service).toBe('openai');
  expect(spring).toHaveBeenCalledTimes(1);
  expect(get('ui-settings-choice-page')).toBeTruthy();
  await act(async () => completions[0]!());
  expect(get('ui-settings-choice-page')).toBeUndefined();
  expect(get('ui-ai-settings')).toBe(page);
  expect(scroll.scrollTop).toBe(120);
  expect(get('ui-tab-bar')).toBeUndefined();
});
it('shows the cached models first, refreshes automatically and preserves surviving rows and scroll', async () => {
  const {services} = await fixture();
  await act(async () => services.ai.update(old => ({...old, connections: {...old.connections, xai: {...old.connections.xai, key: 'test-only-catalog-key'}}})));
  const service = aiServices.find(item => item.id === 'xai')!, connection = services.ai.snapshot().value.connections.xai;
  const scope = catalogScope(service, connection, 'chat');
  const cached = modelCatalog.defaultCatalog(service, connection, 'chat').slice(0, 3);
  await services.catalogs.refresh(scope, async () => cached, new AbortController().signal);
  let finish!: (models: AiModelPreview[]) => void;
  const loader = vi.spyOn(modelCatalog, 'loadAiModels').mockImplementation(() => new Promise(resolve => {finish = resolve;}));
  await click('ui-settings-row-ai'); await click('ui-ai-model');
  const page = get('ui-model-selection'), scroll = get('ui-settings-detail-content'), retained = get(`ui-model-${cached[0]!.id}`);
  scroll.scrollTop = 90;
  expect(loader).toHaveBeenCalledTimes(1);
  expect(retained).toBeTruthy();
  expect(page.textContent).not.toMatch(/새로고침|갱신 중|갱신하지 못/);
  const added = {...cached[0]!, id: 'test-new-model', name: '새 대화 모델'};
  await act(async () => finish([cached[1]!, {...cached[0]!, name: '이름이 갱신된 모델'}, added]));
  expect(get('ui-model-selection')).toBe(page);
  expect(get(`ui-model-${cached[0]!.id}`)).toBe(retained);
  expect(retained.textContent).toContain('이름이 갱신된 모델');
  expect(get('ui-model-test-new-model')).toBeTruthy();
  expect(get(`ui-model-${cached[2]!.id}`)).toBeUndefined();
  expect(scroll.scrollTop).toBe(90);
  expect(services.catalogs.get(scope)?.models[0]?.id).toBe(added.id);
});
it('keeps a failed refresh quiet and preserves the catalog and selection when reopening', async () => {
  const {services} = await fixture();
  await act(async () => services.ai.update(old => ({...old, connections: {...old.connections, xai: {...old.connections.xai, key: 'test-only-catalog-key'}}})));
  const service = aiServices.find(item => item.id === 'xai')!, connection = services.ai.snapshot().value.connections.xai;
  const scope = catalogScope(service, connection, 'chat'), cached = modelCatalog.defaultCatalog(service, connection, 'chat');
  await services.catalogs.refresh(scope, async () => cached, new AbortController().signal);
  const loader = vi.spyOn(modelCatalog, 'loadAiModels').mockRejectedValue(new Error('offline'));
  await click('ui-settings-row-ai'); await click('ui-ai-model');
  await click('ui-model-grok-4.3');
  const page = get('ui-model-selection'), selection = structuredClone(services.ai.snapshot().value);
  expect(page.textContent).not.toMatch(/새로고침|갱신|실패|실행|복원/);
  expect(get(`ui-model-${cached[0]!.id}`)).toBeTruthy();
  expect(visible('[data-testid="ui-model-list"] [role="button"]').map(row => row.textContent)).toEqual(cached.map(model => model.name));
  expect(get('ui-model-grok-4.3').querySelectorAll('img')).toHaveLength(1);
  expect(services.catalogs.get(scope)?.models).toEqual(cached);
  expect(loader).toHaveBeenCalledTimes(1);
  await click('ui-settings-back'); await click('ui-ai-model');
  expect(loader).toHaveBeenCalledTimes(2);
  expect(services.ai.snapshot().value).toEqual(selection);
  expect(services.catalogs.get(scope)?.models).toEqual(cached);
  expect(get('ui-model-grok-4.3').querySelectorAll('img')).toHaveLength(1);
});
it('animates arrivals after an interrupted mount and reverses removal without replacing surviving rows', async () => {
  const motions = await controlledModelAnimations();
  const [first, second] = aiServices.find(item => item.id === 'xai')!.models;
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const render = async (models: AiModelPreview[]) => act(async () => root!.render(<StrictMode>
    <AnimatedModelRows models={models} selected={first!.id} onChoose={() => {}}/>
  </StrictMode>));
  await render([first!]);
  const retained = get(`ui-model-${first!.id}`);
  expect(motions).toHaveLength(0);
  await render([first!, second!]);
  expect(motions.at(-1)?.to).toBe(1);
  await act(async () => motions.splice(0).forEach(motion => motion.finish()));
  await render([first!]);
  const departure = motions.splice(0);
  expect(departure.at(-1)?.to).toBe(0);
  expect(get(`ui-model-${second!.id}`)).toBeUndefined();
  await render([first!, second!]);
  const arrival = motions.splice(0);
  expect(arrival.at(-1)?.to).toBe(1);
  await act(async () => {departure.forEach(motion => motion.finish()); arrival.forEach(motion => motion.finish());});
  expect(get(`ui-model-${first!.id}`)).toBe(retained);
  expect(get(`ui-model-${second!.id}`)).toBeTruthy();
});
it('makes space for a batch of arrivals, preserves whole rows, and ignores a cancelled batch completion', async () => {
  const pending = await controlledModelAnimations();
  const seed = aiServices.find(item => item.id === 'xai')!.models[0]!;
  const original = Array.from({length: 7}, (_,i) => ({...seed, id: `row-${i}`, name: `Model ${i}`}));
  const added = Array.from({length: 3}, (_,i) => ({...seed, id: `new-${i}`, name: `New ${i}`}));
  const changed = [added[0]!, original[0]!, original[2]!, added[1]!, original[4]!, original[6]!, added[2]!];
  const onChoose = vi.fn();
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const render = (models: AiModelPreview[]) => act(async () => root!.render(<StrictMode>
    <AnimatedModelRows models={models} selected="row-2" onChoose={onChoose}/>
  </StrictMode>));
  await render(original);
  const retained = get('ui-model-row-2'), departing = get('ui-model-row-1');
  expect(pending).toHaveLength(0);
  await render(changed);
  const batch = pending.splice(0);
  expect(get('ui-model-row-2')).toBe(retained);
  expect(retained.querySelectorAll('img')).toHaveLength(1);
  expect(departing.isConnected).toBe(true);
  expect(departing.getAttribute('aria-disabled')).toBe('true');
  await act(async () => departing.click());
  expect(onChoose).not.toHaveBeenCalled();
  expect(get('ui-model-new-0')).toBeUndefined();
  const arriving = document.querySelector('[data-testid="ui-model-position-new-0"]') as HTMLElement;
  expect(arriving.style.opacity).toBe('0');
  expect(arriving.style.height).toBe('');
  expect(batch.filter(motion => motion.to === 1 && motion.delay > 0)).toHaveLength(3);
  // A metadata/measurement update must not reveal a waiting row before its space is ready.
  await render(changed.map(model => model.id === 'new-0' ? {...model, name: 'New name'} : model));
  const renamed = pending.splice(0);
  await act(async () => batch.forEach(motion => motion.finish()));
  expect(get('ui-model-new-0')).toBeUndefined();
  expect(arriving.style.opacity).toBe('0');
  await act(async () => renamed.forEach(motion => motion.finish()));
  expect(visible('[data-testid="ui-model-list"] [role="button"]')).toHaveLength(7);
  expect(get('ui-model-new-0')).toBeTruthy();
  expect(get('ui-model-new-0').textContent).toBe('New name');
  expect(arriving.style.opacity).toBe('1');
  expect(arriving.style.transform).toContain('translateY(0px)');
  expect(departing.isConnected).toBe(false);

  await render(original);
  const cancelled = pending.splice(0);
  await render(changed);
  const replacement = pending.splice(0);
  await act(async () => cancelled.forEach(motion => motion.finish()));
  expect(get('ui-model-row-2')).toBe(retained);
  expect(get('ui-model-new-0')).toBeTruthy();
  await act(async () => replacement.forEach(motion => motion.finish()));
  expect(visible('[data-testid="ui-model-list"] [role="button"]')).toHaveLength(7);
  expect(get('ui-model-row-1')).toBeUndefined();
  expect(get('ui-model-new-2')).toBeTruthy();
  expect(get('ui-model-row-2')).toBe(retained);
});
it('paints the cached theme while storage is loading, then reconciles the saved preference', async () => {
  let finish!: () => void;
  const gate = new Promise<void>(resolve => {finish = resolve;});
  const repo = {getSetting: async (key: string) => {await gate; return key === 'appearance:theme' ? 'light' : undefined;}, setSetting: async () => {}};
  const services = createSettingsServices(repo, {get: async () => null, set: async () => {}, remove: async () => {}});
  const memory = new ScreenMemory({readSync: () => null, readBackupSync: () => null, read: async () => null, write: async () => {}, readViewSync: () => null, writeView: async () => {}});
  memory.updateView(view => ({...view, themeMode: 'dark'}));
  function Probe() {return <span data-testid="theme-probe">{useTheme().appearance}</span>;}
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<SettingsServicesProvider services={services}><ThemeProvider memory={memory}><Probe/></ThemeProvider></SettingsServicesProvider>));
  expect(get('theme-probe').textContent).toBe('dark');
  await act(async () => {finish(); await services.load();});
  expect(get('theme-probe').textContent).toBe('light');
  expect(memory.getSnapshot().view.themeMode).toBe('light');
});
