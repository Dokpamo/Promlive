// @vitest-environment jsdom
import './ui-image-fixtures';
import {act, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import App from '../App';
import {ScreenMemory} from '../src/ui/ScreenMemory';
import {createSettingsServices} from '../src/ui/settings/SettingsServices';
import {createScreenStorage} from '../src/ui/screenStorage.web';
import {installBrowserScreenStorage} from './browser-screen-storage';
import {desktopLayout, isDesktopLayout} from '../src/ui/desktop/desktopLayout';

const viewport = vi.hoisted(() => ({width: 1280, height: 800, fontScale: 1, scale: 1}));
vi.mock('../src/ui/screenStorage', () => import('../src/ui/screenStorage.web'));
vi.mock('../src/ui/chat-input/InputField', () => import('../src/ui/chat-input/InputField.web'));
vi.mock('react-native', async () => {
  const native = await vi.importActual<typeof import('react-native')>('react-native-web');
  return {...native, AccessibilityInfo: {...native.AccessibilityInfo, isReduceMotionEnabled: async () => true}, useWindowDimensions: () => viewport};
});
vi.mock('react-native-safe-area-context', () => ({SafeAreaProvider: ({children}: {children: ReactNode}) => <>{children}</>, useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0})}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
beforeEach(() => {viewport.width = 1280; viewport.scale = 1; installBrowserScreenStorage();});
afterEach(async () => {if (root) await act(async () => root!.unmount()); root = undefined; document.body.replaceChildren(); vi.restoreAllMocks();});
const get = (id: string) => [...document.querySelectorAll(`[data-testid="${id}"]`)].find(el => !el.closest('[aria-hidden="true"]')) as HTMLElement | undefined;
async function click(id: string) {expect(get(id), id).toBeTruthy(); await act(async () => get(id)!.click());}
async function type(id: string, value: string) {
  const el = get(id) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', {bubbles: true}));
  });
}
async function hover(element: HTMLElement, inside = true) {
  await act(async () => element.dispatchEvent(new MouseEvent(inside ? 'mouseenter' : 'mouseleave')));
}
async function fixture(memory = new ScreenMemory(createScreenStorage())) {
  const values = new Map<string, string>();
  const services = createSettingsServices({getSetting: async key => values.get(key), setSetting: async (key, value) => {values.set(key, value);}},
    {get: async () => null, set: async () => {}, remove: async () => {}});
  await services.load();
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<App memory={memory} settingsServices={services}/>));
  return {memory, services};
}

it('uses a rail for desktop hosts and wide web only, with split panes that fit the available width', () => {
  for (const platform of ['macos', 'windows']) expect(isDesktopLayout(platform, 700)).toBe(true);
  for (const platform of ['ios', 'android']) expect(isDesktopLayout(platform, 1400)).toBe(false);
  expect(isDesktopLayout('web', 412)).toBe(false);
  expect(desktopLayout(840).split).toBe(false);
  const wide = desktopLayout(1280);
  expect(wide.content - wide.chatList).toBeGreaterThan(500);
  expect(wide.columns).toBe(6);
});
it('keeps drafts editable across rail changes and publishes only after completion', async () => {
  const {memory} = await fixture();
  expect(get('ui-desktop-rail')).toBeTruthy(); expect(get('ui-tab-bar')).toBeUndefined();
  expect(get('ui-card-draft-1')).toBeUndefined();
  await click('ui-tab-create'); await click('ui-creation-row-draft-1');
  await type('ui-card-editor-title', '데스크톱에서 이어 쓰는 이야기');
  expect(get('ui-desktop-card-preview')?.textContent).toContain('데스크톱에서 이어 쓰는 이야기');
  await click('ui-tab-library');
  expect(get('ui-card-draft-1')).toBeUndefined(); expect(memory.getSnapshot().view.openedCardId).toBeNull();
  await click('ui-tab-create'); await click('ui-creation-row-draft-1');
  expect((get('ui-card-editor-title') as HTMLTextAreaElement).value).toBe('데스크톱에서 이어 쓰는 이야기');
  await click('ui-card-editor-complete'); await click('ui-tab-library');
  expect(get('ui-card-draft-1')?.textContent).toContain('데스크톱에서 이어 쓰는 이야기');
});
it('keeps the chat list beside its selected conversation and binds input to the conversation pane', async () => {
  const {memory} = await fixture(); await click('ui-tab-chats'); await click('ui-chat-row-night-library');
  expect(get('ui-desktop-chat-list-pane')).toBeTruthy();
  expect(get('ui-chat-row-night-library')?.getAttribute('aria-current')).toBe('true');
  const composer = get('ui-chat-composer')!;
  expect(Number.parseFloat(composer.style.width)).toBeLessThan(800);
  await type('ui-chat-input', '아직 보내지 않은 이야기');
  const other = memory.getSnapshot().data.chats.find(chat => chat.id !== 'night-library')!;
  await click(`ui-chat-row-${other.id}`);
  expect((get('ui-chat-input') as HTMLTextAreaElement).value).not.toBe('아직 보내지 않은 이야기');
  await click('ui-tab-settings'); await click('ui-tab-chats'); await click('ui-chat-row-night-library');
  expect((get('ui-chat-input') as HTMLTextAreaElement).value).toBe('아직 보내지 않은 이야기');
  await click('ui-chat-send');
  const chat = memory.getSnapshot().data.chats.find(item => item.id === 'night-library')!;
  expect(chat.draft).toBe(''); expect(chat.messages.at(-1)?.text).toBe('아직 보내지 않은 이야기');
});
it('retains the settings list while editing a persisted setting and returns from nested pages', async () => {
  const {services} = await fixture(); await click('ui-tab-settings'); await click('ui-settings-user');
  expect(get('ui-desktop-settings-list-pane')).toBeTruthy();
  await type('ui-profile-name', '데스크톱 사용자');
  expect(services.profile.snapshot().value.name).toBe('데스크톱 사용자');
  await click('ui-settings-back');
  expect(get('ui-profile-name')).toBeUndefined();
  await click('ui-settings-row-ai');
  const provider = [...document.querySelectorAll('[role="button"]')].find(el => el.textContent?.includes('프로바이더') && !el.closest('[aria-hidden="true"]')) as HTMLElement;
  expect(provider).toBeTruthy(); await act(async () => provider.click());
  expect(get('ui-desktop-settings-list-pane')).toBeTruthy();
  const back = get('ui-desktop-settings-column-1')!.querySelector<HTMLElement>('[data-testid="ui-settings-back"]')!;
  await act(async () => back.click());
  expect(get('ui-settings-row-ai')?.getAttribute('aria-current')).toBe('page');
});

it('opens child settings on the right, preserves the parent editor, and replaces only the child branch', async () => {
  const {services} = await fixture(); await click('ui-tab-settings'); await click('ui-settings-row-ai');
  const parent = get('ui-desktop-settings-column-0'), field = get('ui-ai-maxTokens');
  await type('ui-ai-maxTokens', '12345');
  await click('ui-ai-provider');
  expect(get('ui-desktop-settings-column-0')).toBe(parent);
  expect(get('ui-ai-maxTokens')).toBe(field);
  expect(get('ui-desktop-settings-column-1')).toBeTruthy();
  expect(get('ui-ai-provider')).toBeTruthy();
  await click('ui-choice-openai');
  expect(services.ai.snapshot().value.service).toBe('openai');
  expect(get('ui-ai-provider')?.textContent).toContain('OpenAI');
  await click('ui-ai-model');
  expect(get('ui-desktop-settings-column-1')).toBeUndefined();
  expect(get('ui-desktop-settings-column-2')).toBeTruthy();
  expect(get('ui-desktop-settings-column-0')).toBe(parent);
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})));
  expect(get('ui-desktop-settings-column-2')).toBeUndefined();
  expect(get('ui-desktop-settings-column-0')).toBe(parent);
  await click('ui-ai-provider'); await click('ui-choice-xai');
  expect((get('ui-ai-maxTokens') as HTMLInputElement).value).toBe('12,345');
});
it('uses one content pane in a narrow desktop window and returns to the chat list', async () => {
  viewport.width = 840;
  await fixture(); await click('ui-tab-chats'); await click('ui-chat-row-night-library');
  expect(get('ui-desktop-rail')).toBeTruthy(); expect(get('ui-desktop-chat-list-pane')).toBeUndefined();
  await click('ui-chat-room-back');
  expect(get('ui-desktop-chat-list-pane')).toBeTruthy(); expect(get('ui-chat-room')).toBeUndefined();
});
it('restores a mobile detail snapshot into the correct desktop tab without trapping rail navigation', async () => {
  const memory = new ScreenMemory(createScreenStorage());
  memory.updateView(view => ({...view, tab: 'library', detailCardId: 'night-library', chatId: 'night-library'}));
  await fixture(memory);
  expect(get('ui-tab-chats')?.getAttribute('aria-selected')).toBe('true');
  expect(get('ui-chat-room')).toBeTruthy();
  await click('ui-tab-create');
  expect(get('ui-create-list')).toBeTruthy(); expect(get('ui-chat-room')).toBeUndefined();
  expect(memory.getSnapshot().view.detailCardId).toBeNull();
});

it('keeps the same desktop pane and draft when only display density changes', async () => {
  const {memory, services} = await fixture();
  await click('ui-tab-chats'); await click('ui-chat-row-night-library');
  await type('ui-chat-input', '모니터를 옮겨도 유지할 초안');
  const input = get('ui-chat-input') as HTMLTextAreaElement;
  const pane = get('ui-desktop-chat-detail-pane');
  const composerWidth = get('ui-chat-composer')!.style.width;
  await act(async () => input.focus());
  for (const density of [2, 1.25, 1]) {
    viewport.scale = density;
    await act(async () => root!.render(<App memory={memory} settingsServices={services}/>));
    expect(get('ui-desktop-chat-detail-pane')).toBe(pane);
    expect(get('ui-chat-input')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('모니터를 옮겨도 유지할 초안');
    expect(get('ui-chat-composer')!.style.width).toBe(composerWidth);
    expect(get('ui-tab-chats')?.getAttribute('aria-selected')).toBe('true');
  }
});

it('previews desktop hover without navigating or changing the chosen pill', async () => {
  const {memory} = await fixture();
  const tab = get('ui-tab-chats')!, before = memory.getSnapshot().view, idle = tab.style.backgroundColor;
  await hover(tab);
  expect(tab.style.backgroundColor).not.toBe(idle);
  expect(tab.getAttribute('aria-selected')).toBe('false');
  expect(memory.getSnapshot().view).toBe(before);
  await hover(tab, false);
  expect(tab.style.backgroundColor).toBe(idle);
  const pills = get('ui-library-filters')!.querySelectorAll<HTMLElement>('[role="button"]');
  const selected = [...pills].find(el => el.getAttribute('aria-pressed') === 'true')!;
  const other = [...pills].find(el => el.getAttribute('aria-pressed') === 'false')!;
  const selectedBackground = (selected.firstElementChild as HTMLElement).style.backgroundColor;
  await hover(other);
  expect((other.firstElementChild as HTMLElement).style.backgroundColor).toBe(selectedBackground);
  expect(other.getAttribute('aria-pressed')).toBe('false');
  expect(selected.getAttribute('aria-pressed')).toBe('true');
  await hover(selected);
  expect((selected.firstElementChild as HTMLElement).style.backgroundColor).toBe(selectedBackground);
  expect(memory.getSnapshot().view).toBe(before);
});

it('outlines cards on desktop hover and keeps field focus visible without changing their geometry', async () => {
  await fixture();
  const card = get('ui-card-night-library')!;
  const outline = card.querySelector<HTMLElement>('[data-testid="ui-card-night-library-hover"]')!;
  const width = card.style.width, idleBorder = getComputedStyle(outline).borderTopColor;
  await hover(card);
  expect(getComputedStyle(outline).borderTopColor).not.toBe(idleBorder);
  expect(card.style.width).toBe(width);
  await hover(card, false);
  expect(getComputedStyle(outline).borderTopColor).toBe(idleBorder);
  await click('ui-tab-settings'); await click('ui-settings-row-ai');
  for (const id of ['ui-ai-api-key', 'ui-ai-maxTokens']) {
    const input = get(id) as HTMLInputElement;
    const fieldOutline = document.querySelector<HTMLElement>(`[data-testid="${id}-outline"]`)!;
    const field = fieldOutline.parentElement!, height = input.style.minHeight;
    const idleBorder = getComputedStyle(fieldOutline).borderTopColor;
    await hover(field);
    const hoverColor = getComputedStyle(fieldOutline).borderTopColor;
    expect(hoverColor).not.toBe(idleBorder);
    await act(async () => input.focus());
    expect(getComputedStyle(fieldOutline).borderTopColor).not.toBe(hoverColor);
    await hover(field, false);
    expect(getComputedStyle(fieldOutline).borderTopColor).not.toBe(idleBorder);
    expect(document.activeElement).toBe(input);
    expect(input.style.minHeight).toBe(height);
    await act(async () => input.blur());
    expect(getComputedStyle(fieldOutline).borderTopColor).toBe(idleBorder);
  }
});

it('does not add desktop hover on the mobile shell', async () => {
  viewport.width = 412;
  await fixture();
  const tab = get('ui-tab-chats')!, idle = tab.style.backgroundColor;
  await hover(tab);
  expect(tab.style.backgroundColor).toBe(idle);
  expect(tab.getAttribute('aria-selected')).toBe('false');
  expect(get('ui-card-night-library-hover')).toBeUndefined();
});
