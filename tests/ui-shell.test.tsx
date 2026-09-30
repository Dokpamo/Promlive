// @vitest-environment jsdom
import {act, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import App from '../App';

vi.mock('react-native', async () => ({...await vi.importActual<typeof import('react-native')>('react-native-web'),
  useWindowDimensions: () => ({width: 412, height: 892, fontScale: 1, scale: 1}),
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({children}: {children: ReactNode}) => <>{children}</>,
  useSafeAreaInsets: () => ({top: 24, right: 0, bottom: 24, left: 0}),
}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(async () => {if (root) await act(async () => root!.unmount()); root = undefined; document.body.replaceChildren();});

async function clickControl(id: string) {
  const element = document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  expect(element, id).not.toBeNull();
  await act(async () => element!.click());
}
async function enterText(id: string, value: string) {
  const element = document.querySelector(`[data-testid="${id}"]`) as HTMLInputElement | HTMLTextAreaElement;
  const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', {bubbles: true}));
  });
}

it('shows all four new root screens while leaving legacy actions disconnected', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App/>));
  expect([...document.querySelectorAll('[role="tab"]')].map(tab => tab.getAttribute('aria-label'))).toEqual(['서재', '채팅', '생성', '설정']);
  for (const [id, label] of [['library', '서재'], ['chats', '채팅'], ['create', '생성'], ['settings', '설정']]) {
    const tab = document.querySelector(`[data-testid="ui-tab-${id}"]`) as HTMLElement;
    await act(async () => tab.click());
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('[data-testid="ui-title"]')?.textContent).toBe(label);
    const page = document.querySelector(`[data-testid="ui-page-${id}"]`)!;
    if (id === 'library') {
      expect(page.querySelectorAll('[data-testid^="ui-bot-card-"]')).toHaveLength(12);
      const headerButtons = [...document.querySelectorAll('[data-testid="ui-header"] [role="button"]')];
      expect(headerButtons.map(button => button.getAttribute('aria-label'))).toEqual(['서재 검색', '카드 가져오기']);
    } else if (id === 'chats') {
      expect(page.querySelectorAll('[data-testid^="ui-chat-row-"]')).toHaveLength(12);
      expect(page.querySelectorAll('[data-testid^="ui-chat-time-"]')).toHaveLength(12);
      const headerButtons = [...document.querySelectorAll('[data-testid="ui-header"] [role="button"]')];
      expect(headerButtons.map(button => button.getAttribute('aria-label'))).toEqual(['채팅 검색', '새 채팅']);
      expect([...page.querySelectorAll('[role="heading"]')].map(heading => heading.textContent)).toEqual(['채팅']);
    } else if (id === 'create') {
      expect(page.querySelector('[data-testid="ui-create-list"]')).not.toBeNull();
      expect(page.querySelector('[data-testid="ui-creation-row-draft-1"]')).not.toBeNull();
      expect(page.querySelectorAll('[data-testid^="ui-create-filter-"]')).toHaveLength(5);
      const headerButtons = [...document.querySelectorAll('[data-testid="ui-header"] [role="button"]')];
      expect(headerButtons.map(button => button.getAttribute('aria-label'))).toEqual(['생성 검색', '새 카드 만들기']);
    } else {
      expect(page.querySelector('[data-testid="ui-settings-list"]')).not.toBeNull();
      expect(page.querySelector('[data-testid="ui-settings-user"]')?.textContent).toBe('사용자이름과 프로필 이미지');
      expect([...page.querySelectorAll('[data-testid^="ui-settings-row-"]')].map(row => row.textContent))
        .toEqual(['AI', '페르소나', '프롬프트', '테마', '언어', '플러그인', '정보']);
      expect(page.querySelectorAll('[role="button"], input, textarea')).toHaveLength(0);
      expect(page.textContent).not.toMatch(/버전|Meta|팔로우/);
      expect(document.querySelector('[data-testid="ui-library-search-button"]')).toBeNull();
    }
    const action = document.querySelector('[data-testid="ui-header-action"]') as HTMLElement;
    if (id === 'create') expect(action.getAttribute('aria-disabled')).not.toBe('true');
    else expect(action.getAttribute('aria-disabled')).toBe('true');
    if (id !== 'create') await act(async () => action.click());
    expect(document.querySelector(`[data-testid="ui-page-${id}"]`)).toBe(page);
    expect(document.querySelectorAll('input, textarea, [role="dialog"]')).toHaveLength(0);
    if (id !== 'create') expect(document.querySelectorAll('[role="button"]')).toHaveLength(id === 'library' ? 5 : id === 'chats' ? 2 : 1);
    expect(document.querySelectorAll('[data-testid^="ui-page-"]')).toHaveLength(1);
  }
});

it('searches chat titles and AI replies while keeping library and chat search independent', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App/>));
  const click = async (id: string) => {
    await act(async () => (document.querySelector(`[data-testid="${id}"]`) as HTMLElement).click());
  };
  const type = async (id: string, value: string) => {
    const input = document.querySelector(`[data-testid="${id}"]`) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', {bubbles: true}));
    });
  };
  await click('ui-library-search-button');
  await type('ui-library-search-input', '서율');
  await click('ui-tab-chats');
  expect(document.querySelector('input')).toBeNull();
  expect(document.querySelectorAll('[data-testid^="ui-chat-row-"]')).toHaveLength(12);
  await click('ui-chats-search-button');
  await type('ui-chats-search-input', '유성');
  expect(document.querySelectorAll('[data-testid^="ui-chat-row-"]')).toHaveLength(1);
  expect(document.querySelector('[data-testid="ui-chat-message-orbit-cafe"]')?.textContent).toMatch(/^창밖을 봐\./);
  await type('ui-chats-search-input', '유리 온실');
  expect(document.querySelector('[data-testid="ui-chat-row-glass-garden"]')).not.toBeNull();
  await click('ui-tab-library');
  expect((document.querySelector('[data-testid="ui-library-search-input"]') as HTMLInputElement).value).toBe('서율');
  expect(document.querySelectorAll('[data-testid^="ui-bot-card-"]')).toHaveLength(1);
  await click('ui-tab-chats');
  expect((document.querySelector('[data-testid="ui-chats-search-input"]') as HTMLInputElement).value).toBe('유리 온실');
  await type('ui-chats-search-input', '없는 대화');
  expect(document.querySelector('[data-testid="ui-chats-no-results"]')).not.toBeNull();
  await act(async () => (document.querySelector('[aria-label="검색어 지우기"]') as HTMLElement).click());
  expect(document.querySelectorAll('[data-testid^="ui-chat-row-"]')).toHaveLength(12);
  await act(async () => (document.querySelector('[aria-label="검색 닫기"]') as HTMLElement).click());
  expect(document.querySelector('input')).toBeNull();
  expect(document.querySelector('[data-testid="ui-chats-search-button"]')?.getAttribute('aria-expanded')).toBe('false');
});

it('searches preview cards and can clear or close search without opening legacy screens', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App/>));
  const search = document.querySelector('[data-testid="ui-library-search-button"]') as HTMLElement;
  await act(async () => search.click());
  expect(search.getAttribute('aria-expanded')).toBe('true');
  const input = document.querySelector('[data-testid="ui-library-search-input"]') as HTMLInputElement;
  const type = async (value: string) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', {bubbles: true}));
    });
  };
  await type('서율');
  expect(document.querySelectorAll('[data-testid^="ui-bot-card-"]')).toHaveLength(1);
  expect(document.querySelector('[data-testid="ui-bot-card-night-library"]')).not.toBeNull();
  await type('꽃비');
  expect(document.querySelector('[data-testid="ui-bot-card-glass-garden"]')).not.toBeNull();
  await type('없는 카드');
  expect(document.querySelectorAll('[data-testid^="ui-bot-card-"]')).toHaveLength(0);
  expect(document.querySelector('[data-testid="ui-library-no-results"]')).not.toBeNull();
  await act(async () => (document.querySelector('[aria-label="검색어 지우기"]') as HTMLElement).click());
  expect(input.value).toBe('');
  expect(document.querySelectorAll('[data-testid^="ui-bot-card-"]')).toHaveLength(12);
  await type('noah');
  expect(document.querySelector('[data-testid="ui-bot-card-orbit-cafe"]')).not.toBeNull();
  await act(async () => (document.querySelector('[aria-label="검색 닫기"]') as HTMLElement).click());
  expect(document.querySelector('input')).toBeNull();
  expect(search.getAttribute('aria-expanded')).toBe('false');
  expect(document.querySelectorAll('[data-testid^="ui-bot-card-"]')).toHaveLength(12);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it('opens a creation draft, retains edits when returning, and only adds it to the library on completion', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App/>));
  expect(document.querySelector('[data-testid="ui-bot-card-draft-1"]')).toBeNull();
  await clickControl('ui-tab-create');
  await clickControl('ui-create-filter-draft');
  expect(document.querySelectorAll('[data-testid^="ui-creation-row-"]')).toHaveLength(3);
  await clickControl('ui-creation-row-draft-1');
  expect(document.querySelector('[data-testid="ui-card-editor"]')).not.toBeNull();
  await enterText('ui-card-editor-title', '새로 완성할 이야기');
  await clickControl('ui-card-editor-back');
  expect(document.querySelector('[data-testid="ui-create-filter-draft"]')?.getAttribute('aria-pressed')).toBe('true');
  expect(document.querySelector('[data-testid="ui-creation-title-draft-1"]')?.textContent).toBe('새로 완성할 이야기');
  await clickControl('ui-tab-library');
  expect(document.querySelectorAll('[data-testid^="ui-bot-card-"]')).toHaveLength(12);
  expect(document.querySelector('[data-testid="ui-bot-card-draft-1"]')).toBeNull();
  await clickControl('ui-tab-create');
  await clickControl('ui-create-search-button');
  await enterText('ui-create-search-input', '새로 완성할');
  expect(document.querySelectorAll('[data-testid^="ui-creation-row-"]')).toHaveLength(1);
  await clickControl('ui-creation-row-draft-1');
  expect((document.querySelector('[data-testid="ui-card-editor-title"]') as HTMLTextAreaElement).value).toBe('새로 완성할 이야기');
  await clickControl('ui-card-editor-complete');
  expect(document.querySelector('[data-testid="ui-card-editor"]')).toBeNull();
  expect(document.querySelector('[data-testid="ui-creation-summary-draft-1"]')?.textContent).toMatch(/^완성/);
  await clickControl('ui-tab-library');
  expect(document.querySelector('[data-testid="ui-bot-card-draft-1"]')?.textContent).toContain('새로 완성할 이야기');
});

it('groups external cards for editing while preserving their published versions until completion', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App/>));
  const original = document.querySelector('[data-testid="ui-bot-card-night-library"]')!.textContent;
  await clickControl('ui-tab-create');
  await clickControl('ui-create-filter-external');
  expect(document.querySelector('[data-testid="ui-creation-row-draft-1"]')).toBeNull();
  await clickControl('ui-creation-row-night-library');
  expect(document.querySelector('[data-testid="ui-card-editor-status"]')?.textContent).toContain('외부 카드');
  await enterText('ui-card-editor-title', '외부 카드 편집본');
  await enterText('ui-card-editor-introduction', '새로운 시작 장면');
  await clickControl('ui-card-editor-back');
  await clickControl('ui-tab-library');
  expect(document.querySelector('[data-testid="ui-bot-card-night-library"]')!.textContent).toBe(original);
  await clickControl('ui-tab-create');
  await clickControl('ui-create-filter-external');
  await clickControl('ui-creation-row-night-library');
  expect((document.querySelector('[data-testid="ui-card-editor-introduction"]') as HTMLTextAreaElement).value).toBe('새로운 시작 장면');
  await clickControl('ui-card-editor-complete');
  await clickControl('ui-tab-library');
  expect(document.querySelectorAll('[data-testid="ui-bot-card-night-library"]')).toHaveLength(1);
  expect(document.querySelector('[data-testid="ui-bot-card-night-library"]')!.textContent).toContain('외부 카드 편집본');
});

it('starts new drafts from the plus button and requires a title to complete them', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App/>));
  await clickControl('ui-tab-create');
  await clickControl('ui-header-action');
  await clickControl('ui-card-editor-complete');
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('제목');
  await enterText('ui-card-editor-title', '플러스로 만든 카드');
  await enterText('ui-card-editor-summary', '작성한 소개');
  await clickControl('ui-card-editor-back');
  await clickControl('ui-tab-library');
  expect(document.querySelector('[data-testid^="ui-bot-card-created-"]')).toBeNull();
  await clickControl('ui-tab-create');
  await clickControl('ui-create-filter-mine');
  const newRow = document.querySelector('[data-testid^="ui-creation-row-created-"]') as HTMLElement;
  await act(async () => newRow.click());
  expect((document.querySelector('[data-testid="ui-card-editor-summary"]') as HTMLTextAreaElement).value).toBe('작성한 소개');
  await clickControl('ui-card-editor-complete');
  await clickControl('ui-tab-library');
  expect(document.querySelector('[data-testid^="ui-bot-card-created-"]')?.textContent).toContain('플러스로 만든 카드');
});
