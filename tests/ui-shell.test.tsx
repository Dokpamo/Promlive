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

it('shows only the new library grid and leaves legacy header actions disconnected', async () => {
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
    } else {
      expect(page.childElementCount).toBe(0);
      expect(document.querySelector('[data-testid="ui-library-search-button"]')).toBeNull();
    }
    const action = document.querySelector('[data-testid="ui-header-action"]') as HTMLElement;
    expect(action.getAttribute('aria-disabled')).toBe('true');
    await act(async () => action.click());
    expect(document.querySelector(`[data-testid="ui-page-${id}"]`)).toBe(page);
    expect(document.querySelectorAll('input, textarea, [role="dialog"]')).toHaveLength(0);
    expect(document.querySelectorAll('[role="button"]')).toHaveLength(id === 'library' ? 2 : 1);
    expect(document.querySelectorAll('[data-testid^="ui-page-"]')).toHaveLength(1);
  }
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
