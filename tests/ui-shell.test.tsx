// @vitest-environment jsdom
import {act, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {AccessibilityInfo, Animated} from 'react-native';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import App from '../App';
import {ScreenMemory} from '../src/ui/ScreenMemory';
import {createScreenStorage} from '../src/ui/screenStorage.web';

vi.mock('../src/ui/screenStorage', () => import('../src/ui/screenStorage.web'));

vi.mock('react-native', async () => {
  const native = await vi.importActual<typeof import('react-native')>('react-native-web');
  return {...native,
    AccessibilityInfo: {...native.AccessibilityInfo, isReduceMotionEnabled: async () => false},
    useWindowDimensions: () => ({width: 412, height: 892, fontScale: 1, scale: 1}),
  };
});
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({children}: {children: ReactNode}) => <>{children}</>,
  useSafeAreaInsets: () => ({top: 24, right: 0, bottom: 24, left: 0}),
}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
beforeEach(() => {
  // Node's optional localStorage can shadow jsdom's browser storage in this runner.
  const values = new Map<string, string>();
  const storage: Storage = {get length() {return values.size;}, key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null, setItem: (key, value) => {values.set(key, value);},
    removeItem: key => {values.delete(key);}, clear: () => values.clear()};
  Object.defineProperty(window, 'localStorage', {configurable: true, value: storage});
});
afterEach(async () => {if (root) await act(async () => root!.unmount()); root = undefined; document.body.replaceChildren(); vi.restoreAllMocks();});

// Inactive tab pages stay mounted, but are hidden from users and accessibility.
function queryAll(selector: string) {
  return [...document.querySelectorAll(selector)].filter(element => !element.closest('[aria-hidden="true"]'));
}
function query(selector: string) {
  return queryAll(selector)[0] ?? null;
}

async function clickControl(id: string, settle = true) {
  const element = query(`[data-testid="${id}"]`) as HTMLElement | null;
  expect(element, id).not.toBeNull();
  await act(async () => element!.click());
  const motion = query('[data-testid="ui-back-motion"]') as HTMLElement | null;
  if (settle && motion && motion.style.transform !== 'translateX(0px)') {
    await act(async () => {await new Promise(resolve => setTimeout(resolve, 600));});
  }
}
async function enterText(id: string, value: string) {
  const element = query(`[data-testid="${id}"]`) as HTMLInputElement | HTMLTextAreaElement;
  const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', {bubbles: true}));
  });
}

async function beginDrag(id: string, from: number, to: number) {
  const target = query(`[data-testid="${id}"]`)!;
  const dispatch = async (type: string, x: number, buttons: number) => {
    await act(async () => {
      target.dispatchEvent(new MouseEvent(type, {bubbles: true, clientX: x, clientY: 450, button: 0, buttons}));
      await new Promise(resolve => setTimeout(resolve, 25));
    });
  };
  await dispatch('mousedown', from, 1);
  await dispatch('mousemove', from + (to - from) * 0.2, 1);
  await dispatch('mousemove', to, 1);
  return () => dispatch('mouseup', to, 0);
}

async function dragBody(id: string, from: number, to: number) {
  const release = await beginDrag(id, from, to);
  await release();
  await act(async () => {await new Promise(resolve => setTimeout(resolve, id === 'ui-back-swipe' ? 550 : 260));});
}

it('opens from the right with the same full-size underlay and safely interrupts an entrance with back', async () => {
  // RN Web uses immediate AnimatedMock in tests. Hold native frames explicitly
  // so this checks mounted content and stale completion, not a wall-clock delay.
  const entries: {source: Animated.Value; complete: () => void}[] = [];
  vi.spyOn(Animated, 'spring').mockImplementation(source => ({
    start: callback => entries.push({source: source as Animated.Value, complete: () => callback?.({finished: true})}),
    stop: () => {}, reset: () => {},
  }));
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App/>));
  const underlay = query('[data-testid="ui-root-screen"]') as HTMLElement;
  const tint = underlay.querySelector('[data-testid="ui-root-screen-dim"]') as HTMLElement;
  const x = (element: HTMLElement) => Number(element.style.transform.match(/translateX\(([-\d.]+)px\)/)?.[1]);
  await clickControl('ui-bot-card-night-library', false);
  const motion = query('[data-testid="ui-back-motion"]') as HTMLElement;
  expect(x(motion)).toBeGreaterThan(0);
  expect(x(motion)).toBeLessThanOrEqual(412);
  await act(async () => entries[0]!.source.setValue(206));
  expect(x(motion)).toBeGreaterThan(0);
  expect(x(motion)).toBeLessThan(412);
  expect(x(underlay)).toBeCloseTo((x(motion) - 412) * 0.3);
  expect(Number(tint.style.opacity)).toBeCloseTo((1 - x(motion) / 412) * 0.12);
  expect(underlay.style.opacity).toBe('1');
  expect((query('[data-testid="ui-back-page"]') as HTMLElement).style.borderTopLeftRadius).toBe('32px');
  await clickControl('ui-card-detail-back', false);
  expect(query('[data-testid="ui-card-detail"]')).toBeNull();
  expect(x(underlay)).toBe(0);
  expect(Number(tint.style.opacity)).toBe(0);
  // An old entry completion must not pull the root away again after close/reopen.
  await clickControl('ui-bot-card-night-library', false);
  await act(async () => entries[0]!.complete());
  expect(x(query('[data-testid="ui-back-motion"]') as HTMLElement)).toBe(412);
  await act(async () => {entries[1]!.source.setValue(0); entries[1]!.complete();});
  expect(x(query('[data-testid="ui-back-motion"]') as HTMLElement)).toBe(0);
  expect((query('[data-testid="ui-back-page"]') as HTMLElement).style.borderTopLeftRadius).toBe('0px');
  await clickControl('ui-card-detail-back');
  expect(x(underlay)).toBe(0);
  expect(Number(tint.style.opacity)).toBe(0);
});

it('opens immediately when the system requests reduced motion', async () => {
  vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App/>));
  await clickControl('ui-bot-card-night-library', false);
  expect((query('[data-testid="ui-back-motion"]') as HTMLElement).style.transform).toBe('translateX(0px)');
  expect((query('[data-testid="ui-back-page"]') as HTMLElement).style.borderTopLeftRadius).toBe('0px');
});

it('opens a cover-only viewer, pans only when zoomed and returns to the same detail position', async () => {
  const memory = new ScreenMemory(createScreenStorage());
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App memory={memory}/>));
  await clickControl('ui-bot-card-night-library');
  const detail = query('[data-testid="ui-card-detail-content"]')!;
  detail.scrollTop = 145;
  await clickControl('ui-card-detail-cover');
  expect(query('[data-testid="ui-image-viewer"]')).not.toBeNull();
  expect(query('[data-testid="ui-card-detail-title"]')).toBeNull();
  expect(query('[data-testid="ui-tab-bar"]')).toBeNull();
  const artwork = query('[data-testid="ui-image-artwork"]') as HTMLElement;
  expect(parseFloat(artwork.style.width)).toBe(412);
  expect(parseFloat(artwork.style.height)).toBeCloseTo(412 * 4 / 3);
  await clickControl('ui-image-viewer-zoom');
  expect(query('[data-testid="ui-image-viewer-zoom"]')?.getAttribute('aria-expanded')).toBe('true');
  const transform = query('[data-testid="ui-image-transform"]') as HTMLElement;
  expect(transform.style.transform).toContain('scale(2.5)');
  await dragBody('ui-image-surface', 80, 270);
  expect(memory.getSnapshot().view.coverOpen).toBe(true);
  expect(transform.style.transform).not.toContain('translateX(0px)');
  await clickControl('ui-image-viewer-zoom');
  expect(transform.style.transform).toContain('scale(1)');
  await dragBody('ui-back-swipe', 60, 350);
  expect(memory.getSnapshot().view.coverOpen).toBe(false);
  expect(query('[data-testid="ui-card-detail-content"]')).toBe(detail);
  expect(detail.scrollTop).toBe(145);
  await clickControl('ui-card-detail-back');
  expect(query('[data-testid="ui-library-grid"]')).not.toBeNull();
}, 10000);

it('restores an open image viewer immediately and closes to its detail before the library', async () => {
  const disk = createScreenStorage(), memory = new ScreenMemory(disk);
  memory.updateView(view => ({...view, detailCardId: 'forest-post', coverOpen: true}));
  await memory.flush();
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App memory={new ScreenMemory(disk)}/>));
  const artwork = query('[data-testid="ui-image-artwork"]') as HTMLElement;
  expect(artwork.style.width).toBe(artwork.style.height);
  expect((query('[data-testid="ui-back-motion"]') as HTMLElement).style.transform).toBe('translateX(0px)');
  await clickControl('ui-image-viewer-back');
  expect(query('[data-testid="ui-card-detail-title"]')?.textContent).toBe('숲의 마지막 우체국에서');
  expect(query('[data-testid="ui-image-viewer"]')).toBeNull();
  await clickControl('ui-card-detail-back');
  expect(query('[data-testid="ui-library-grid"]')).not.toBeNull();
});

it('keeps both bars fixed while adjacent filter bodies travel together without a blank frame or fade', async () => {
  const memory = new ScreenMemory(createScreenStorage());
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App memory={memory}/>));
  const page = query('[data-testid="ui-page-library"]') as HTMLElement;
  const header = query('[data-testid="ui-library-scroll-header"]') as HTMLElement;
  const bar = query('[data-testid="ui-tab-bar"]') as HTMLElement;
  const headerPosition = header.style.transform, barPosition = bar.style.transform;
  const release = await beginDrag('ui-library-swipe', 350, 60);
  expect(page.style.transform).toBe('translateX(0px)');
  expect(header.style.transform).toBe(headerPosition);
  expect(bar.style.transform).toBe(barPosition);
  const body = query('[data-testid="ui-library-moving-body"]') as HTMLElement;
  expect(body.style.transform).not.toBe('translateX(0px)');
  const prepared = document.querySelector('[data-testid="ui-prepared-library:recent"]') as HTMLElement;
  const incomingBody = prepared.querySelector('[data-testid="ui-library-moving-body"]') as HTMLElement;
  expect(getComputedStyle(prepared).display).not.toBe('none');
  expect(prepared.style.opacity).toBe('1');
  expect((prepared.querySelector('[data-testid="ui-library-scroll-header"]') as HTMLElement).style.opacity).toBe('0');
  const x = (element: HTMLElement) => Number(element.style.transform.match(/translateX\(([-\d.]+)px\)/)?.[1]);
  expect(x(incomingBody) - x(body)).toBeCloseTo(412);
  expect(x(incomingBody)).toBeGreaterThan(0);
  expect(x(incomingBody)).toBeLessThan(412);
  expect(memory.getSnapshot().view.libraryFilter).toBe('all');
  const landingOpacity: number[] = [];
  const observer = new MutationObserver(() => {
    if (memory.getSnapshot().view.libraryFilter === 'recent') {
      const incoming = query('[data-testid="ui-library-moving-body"]') as HTMLElement;
      if (incoming) landingOpacity.push(Number(incoming.style.opacity || 1));
    }
  });
  observer.observe(container, {subtree: true, attributes: true, attributeFilter: ['style', 'aria-hidden']});
  await release();
  await act(async () => {await new Promise(resolve => setTimeout(resolve, 250));});
  expect(memory.getSnapshot().view.libraryFilter).toBe('recent');
  const destination = query('[data-testid="ui-library-moving-body"]') as HTMLElement;
  expect(destination).toBe(incomingBody);
  expect(destination.style.transform).toBe('translateX(0px)');
  observer.disconnect();
  expect(landingOpacity.length).toBeGreaterThan(0);
  expect(landingOpacity.every(opacity => opacity === 1)).toBe(true);
  // A short drag keeps this content without an opacity change.
  await dragBody('ui-library-swipe', 300, 289);
  expect(memory.getSnapshot().view.libraryFilter).toBe('recent');
  expect(Number(destination.style.opacity || 1)).toBe(1);
});

it('keeps the immediate previous page painted and slides it from the left without resizing or fading', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App/>));
  await clickControl('ui-bot-card-night-library');
  await clickControl('ui-card-detail-more');
  await clickControl('ui-card-detail-edit');
  const underlay = document.querySelector('[data-testid="ui-detail-screen"]') as HTMLElement;
  const dim = underlay.querySelector('[data-testid="ui-detail-screen-dim"]') as HTMLElement;
  const x = () => Number(underlay.style.transform.match(/^translateX\(([-\d.]+)px\)$/)?.[1]);
  expect(x()).toBeCloseTo(-412 * 0.3);
  expect(underlay.style.opacity).toBe('1');
  expect(Number(dim.style.opacity)).toBe(0.12);
  // The rounded page spans the display; only its content is inset below the status bar.
  expect((query('[data-testid="ui-shell"]') as HTMLElement).style.paddingTop).toBe('');
  expect((query('[data-testid="ui-back-safe-content"]') as HTMLElement).style.paddingTop).toBe('24px');
  const release = await beginDrag('ui-back-swipe', 60, 280);
  const page = query('[data-testid="ui-back-page"]') as HTMLElement;
  const rootScreen = document.querySelector('[data-testid="ui-root-screen"]') as HTMLElement;
  expect(page.style.borderTopLeftRadius).toBe('32px');
  expect(x()).toBeGreaterThan(-412 * 0.3);
  expect(x()).toBeLessThan(0);
  expect(Number(underlay.style.opacity)).toBe(1);
  expect(Number(dim.style.opacity)).toBeGreaterThan(0);
  expect(Number(dim.style.opacity)).toBeLessThan(0.12);
  expect(Number((query('[data-testid="ui-back-shadow"]') as HTMLElement).style.opacity)).toBe(1);
  expect(Number(rootScreen.style.opacity)).toBe(0);
  await release();
  await act(async () => {await new Promise(resolve => setTimeout(resolve, 550));});
  expect(query('[data-testid="ui-card-editor"]')).toBeNull();
  expect(query('[data-testid="ui-card-detail"]')).not.toBeNull();
  expect(underlay.style.transform).toBe('translateX(0px)');
  expect(Number(dim.style.opacity)).toBe(0);
  // A cancelled return restores the foreground without leaving a shadow or a stale dim layer.
  await dragBody('ui-back-swipe', 60, 71);
  expect(query('[data-testid="ui-card-detail"]')).not.toBeNull();
  expect((query('[data-testid="ui-back-page"]') as HTMLElement).style.borderTopLeftRadius).toBe('0px');
  expect(Number((query('[data-testid="ui-back-shadow"]') as HTMLElement).style.opacity)).toBe(0);
  expect(Number(dim.style.opacity)).toBe(0);
});

it('keeps a collapsed header at the same height when a swipe lands on a shorter filter', async () => {
  const disk = createScreenStorage();
  const memory = new ScreenMemory(disk);
  memory.rememberScroll('library:all', {offset: 320, hidden: 120, height: 120, maxOffset: 600});
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App memory={memory}/>));
  const previous = query('[data-testid="ui-library-scroll-header"]') as HTMLElement;
  expect(previous.style.transform).toBe('translateY(-120px)');
  await dragBody('ui-library-swipe', 350, 60);
  expect(memory.getSnapshot().view.libraryFilter).toBe('recent');
  const next = query('[data-testid="ui-library-scroll-header"]') as HTMLElement;
  expect(next.style.transform).toBe(previous.style.transform);
  // The new short list can scroll downward to reveal the preserved header again.
  expect(memory.getScroll('library:recent').maxOffset).toBeGreaterThan(120);
  // Native pixel rounding can put the measured range slightly above the requested minimum.
  memory.rememberScroll('library:recent', {offset: 120, hidden: 120, height: 120, maxOffset: 121.142857});
  await memory.flush();
  await act(async () => root!.unmount());
  root = createRoot(container);
  await act(async () => root!.render(<App memory={new ScreenMemory(disk)}/>));
  expect((query('[data-testid="ui-library-scroll-header"]') as HTMLElement).style.transform).toBe('translateY(-120px)');
  const grid = query('[data-testid="ui-library-grid"]') as HTMLElement;
  const content = grid.firstElementChild as HTMLElement;
  expect(parseFloat(content.style.minHeight)).toBeGreaterThan(892);
}, 10000);

it('swipes the body through filters before tabs and returns from details without opening a card during the drag', async () => {
  const memory = new ScreenMemory(createScreenStorage());
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App memory={memory}/>));
  await dragBody('ui-library-swipe', 350, 60);
  expect(memory.getSnapshot().view.libraryFilter).toBe('recent');
  expect(memory.getSnapshot().view.detailCardId).toBeNull();
  await dragBody('ui-library-swipe', 350, 60);
  expect(memory.getSnapshot().view.libraryFilter).toBe('idle');
  await dragBody('ui-library-swipe', 350, 60);
  expect(memory.getSnapshot().view.tab).toBe('chats');
  await dragBody('ui-chats-swipe', 60, 350);
  expect(memory.getSnapshot().view.tab).toBe('library');
  expect(memory.getSnapshot().view.libraryFilter).toBe('idle');
  await clickControl('ui-library-filter-all');
  await clickControl('ui-bot-card-night-library');
  await dragBody('ui-back-swipe', 60, 350);
  expect(memory.getSnapshot().view.detailCardId).toBeNull();
  expect(query('[data-testid="ui-library-grid"]')).not.toBeNull();
  await clickControl('ui-bot-card-night-library');
  const reopened = query('[data-testid="ui-back-page"]') as HTMLElement;
  expect(reopened).not.toBeNull();
  expect(reopened.parentElement!.style.transform).toBe('translateX(0px)');
  expect((query('[data-testid="ui-detail-screen"]') as HTMLElement).style.backgroundColor).toBe('');
  await clickControl('ui-card-detail-back');
  expect(memory.getSnapshot().view.detailCardId).toBeNull();
}, 10000);

it('shows all four new root screens while leaving legacy actions disconnected', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App/>));
  expect([...queryAll('[role="tab"]')].map(tab => tab.getAttribute('aria-label'))).toEqual(['서재', '채팅', '생성', '설정']);
  for (const [id, label] of [['library', '서재'], ['chats', '채팅'], ['create', '생성'], ['settings', '설정']]) {
    const tab = query(`[data-testid="ui-tab-${id}"]`) as HTMLElement;
    await act(async () => tab.click());
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(query('[data-testid="ui-title"]')?.textContent).toBe(label);
    const page = query(`[data-testid="ui-page-${id}"]`)!;
    if (id === 'library') {
      expect(page.querySelectorAll('[data-testid^="ui-bot-card-"]')).toHaveLength(12);
      const headerButtons = [...queryAll('[data-testid="ui-header"] [role="button"]')];
      expect(headerButtons.map(button => button.getAttribute('aria-label'))).toEqual(['서재 검색', '카드 가져오기']);
    } else if (id === 'chats') {
      expect(page.querySelectorAll('[data-testid^="ui-chat-row-"]')).toHaveLength(12);
      expect(page.querySelectorAll('[data-testid^="ui-chat-time-"]')).toHaveLength(12);
      const headerButtons = [...queryAll('[data-testid="ui-header"] [role="button"]')];
      expect(headerButtons.map(button => button.getAttribute('aria-label'))).toEqual(['채팅 검색', '새 채팅']);
      expect([...page.querySelectorAll('[role="heading"]')].map(heading => heading.textContent)).toEqual(['채팅']);
    } else if (id === 'create') {
      expect(page.querySelector('[data-testid="ui-create-list"]')).not.toBeNull();
      expect(page.querySelector('[data-testid="ui-creation-row-draft-1"]')).not.toBeNull();
      expect(page.querySelectorAll('[data-testid^="ui-create-filter-"]')).toHaveLength(5);
      const headerButtons = [...queryAll('[data-testid="ui-header"] [role="button"]')];
      expect(headerButtons.map(button => button.getAttribute('aria-label'))).toEqual(['생성 검색', '새 카드 만들기']);
    } else {
      expect(page.querySelector('[data-testid="ui-settings-list"]')).not.toBeNull();
      expect(page.querySelector('[data-testid="ui-settings-user"]')?.textContent).toBe('사용자이름과 프로필 이미지');
      expect([...page.querySelectorAll('[data-testid^="ui-settings-row-"]')].map(row => row.textContent))
        .toEqual(['AI', '페르소나', '프롬프트', '테마', '언어', '플러그인', '정보']);
      expect(page.querySelector('[data-testid="ui-settings-list"]')?.querySelectorAll('[role="button"], input, textarea')).toHaveLength(0);
      expect(page.textContent).not.toMatch(/버전|Meta|팔로우/);
      expect(query('[data-testid="ui-library-search-button"]')).toBeNull();
    }
    const action = query('[data-testid="ui-header-action"]') as HTMLElement;
    if (id === 'create') expect(action.getAttribute('aria-disabled')).not.toBe('true');
    else expect(action.getAttribute('aria-disabled')).toBe('true');
    if (id !== 'create') await act(async () => action.click());
    expect(query(`[data-testid="ui-page-${id}"]`)).toBe(page);
    expect(queryAll('input, textarea, [role="dialog"]')).toHaveLength(0);
    if (id !== 'create') expect(queryAll('[role="button"]')).toHaveLength(id === 'library' ? 17 : id === 'chats' ? 2 : 1);
    expect(queryAll('[data-testid^="ui-page-"]')).toHaveLength(1);
  }
});

it('switches on press down and keeps inactive pages ready without exposing their controls', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App/>));
  await clickControl('ui-library-filter-recent');
  const library = query('[data-testid="ui-page-library"]')!;
  const grid = query('[data-testid="ui-library-grid"]')!;
  grid.scrollTop = 240;
  const chats = query('[data-testid="ui-tab-chats"]')!;

  // No release event or timer advance: the screen and selected icon change together.
  await act(async () => chats.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, button: 0})));
  expect(chats.getAttribute('aria-selected')).toBe('true');
  expect(query('[data-testid="ui-title"]')?.textContent).toBe('채팅');
  expect(library.getAttribute('aria-hidden')).toBe('true');
  expect(getComputedStyle(library).display).toBe('none');
  expect(query('[data-testid="ui-library-search-button"]')).toBeNull();
  await act(async () => chats.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, button: 0})));
  await act(async () => (chats as HTMLElement).click());
  expect(query('[data-testid="ui-title"]')?.textContent).toBe('채팅');

  // Click-only activation covers keyboard/accessibility and programmatic activation.
  await clickControl('ui-tab-library');
  expect(query('[data-testid="ui-page-library"]')).toBe(library);
  expect(query('[data-testid="ui-library-grid"]')).toBe(grid);
  expect(grid.scrollTop).toBe(240);
  expect(query('[data-testid="ui-library-filter-recent"]')?.getAttribute('aria-pressed')).toBe('true');
});

it('opens published card details without a header, preserves the library, and publishes edits only on completion', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App/>));
  await clickControl('ui-library-filter-recent');
  const grid = query('[data-testid="ui-library-grid"]')!;
  grid.scrollTop = 180;
  await clickControl('ui-bot-card-night-library');
  expect(query('[data-testid="ui-header"]')).toBeNull();
  expect(query('[data-testid="ui-tab-bar"]')).toBeNull();
  expect(query('[data-testid="ui-card-detail-title"]')?.textContent).toBe('별이 머무는 도서관');
  await clickControl('ui-card-detail-more');
  expect(query('[data-testid="ui-card-detail-more"]')?.getAttribute('aria-expanded')).toBe('true');
  await clickControl('ui-card-detail-menu-dismiss');
  expect(query('[data-testid="ui-card-detail-menu"]')).toBeNull();
  await clickControl('ui-card-detail-more');
  await clickControl('ui-card-detail-edit');
  await enterText('ui-card-editor-title', '상세에서 편집한 제목');
  await clickControl('ui-card-editor-back');
  expect(query('[data-testid="ui-card-detail-title"]')?.textContent).toBe('별이 머무는 도서관');
  await clickControl('ui-card-detail-more');
  await clickControl('ui-card-detail-edit');
  expect((query('[data-testid="ui-card-editor-title"]') as HTMLTextAreaElement).value).toBe('상세에서 편집한 제목');
  await clickControl('ui-card-editor-complete');
  expect(query('[data-testid="ui-card-detail-title"]')?.textContent).toBe('상세에서 편집한 제목');
  await clickControl('ui-card-detail-back');
  expect(query('[data-testid="ui-library-grid"]')).toBe(grid);
  expect(grid.scrollTop).toBe(180);
  expect(query('[data-testid="ui-library-filter-recent"]')?.getAttribute('aria-pressed')).toBe('true');
  expect(query('[data-testid="ui-bot-card-night-library"]')?.textContent).toContain('상세에서 편집한 제목');
});

it('restores an open card detail on the first render after restart', async () => {
  const disk = createScreenStorage();
  const memory = new ScreenMemory(disk);
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App memory={memory}/>));
  await clickControl('ui-bot-card-night-library');
  await memory.flush();
  await act(async () => root!.unmount());
  root = createRoot(container);
  await act(async () => root!.render(<App memory={new ScreenMemory(disk)}/>));
  expect(query('[data-testid="ui-card-detail-title"]')?.textContent).toBe('별이 머무는 도서관');
  expect(query('[data-testid="ui-library-grid"]')).toBeNull();
  expect((query('[data-testid="ui-back-motion"]') as HTMLElement).style.transform).toBe('translateX(0px)');
  await clickControl('ui-card-detail-back');
  expect(query('[data-testid="ui-library-grid"]')).not.toBeNull();
});

it('searches chat titles and AI replies while keeping library and chat search independent', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App/>));
  const click = async (id: string) => {
    await act(async () => (query(`[data-testid="${id}"]`) as HTMLElement).click());
  };
  const type = async (id: string, value: string) => {
    const input = query(`[data-testid="${id}"]`) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', {bubbles: true}));
    });
  };
  await click('ui-library-search-button');
  await type('ui-library-search-input', '서율');
  await click('ui-tab-chats');
  expect(query('input')).toBeNull();
  expect(queryAll('[data-testid^="ui-chat-row-"]')).toHaveLength(12);
  await click('ui-chats-search-button');
  await type('ui-chats-search-input', '유성');
  expect(queryAll('[data-testid^="ui-chat-row-"]')).toHaveLength(1);
  expect(query('[data-testid="ui-chat-message-orbit-cafe"]')?.textContent).toMatch(/^창밖을 봐\./);
  await type('ui-chats-search-input', '유리 온실');
  expect(query('[data-testid="ui-chat-row-glass-garden"]')).not.toBeNull();
  await click('ui-tab-library');
  expect((query('[data-testid="ui-library-search-input"]') as HTMLInputElement).value).toBe('서율');
  expect(queryAll('[data-testid^="ui-bot-card-"]')).toHaveLength(1);
  await click('ui-tab-chats');
  expect((query('[data-testid="ui-chats-search-input"]') as HTMLInputElement).value).toBe('유리 온실');
  await type('ui-chats-search-input', '없는 대화');
  expect(query('[data-testid="ui-chats-no-results"]')).not.toBeNull();
  await act(async () => (query('[aria-label="검색어 지우기"]') as HTMLElement).click());
  expect(queryAll('[data-testid^="ui-chat-row-"]')).toHaveLength(12);
  await act(async () => (query('[aria-label="검색 닫기"]') as HTMLElement).click());
  expect(query('input')).toBeNull();
  expect(query('[data-testid="ui-chats-search-button"]')?.getAttribute('aria-expanded')).toBe('false');
});

it('opens a saved editor on the first render after restart and restores each tab search and filter', async () => {
  const disk = createScreenStorage();
  const memory = new ScreenMemory(disk);
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App memory={memory}/>));
  await clickControl('ui-library-search-button');
  await enterText('ui-library-search-input', '서율');
  await clickControl('ui-tab-create');
  await clickControl('ui-create-filter-mine');
  await clickControl('ui-creation-row-draft-1');
  await enterText('ui-card-editor-summary', '앱을 꺼도 남아야 하는 내용');
  await memory.flush();
  await act(async () => root!.unmount());
  root = createRoot(container);
  const reopened = new ScreenMemory(disk);
  await act(async () => root!.render(<App memory={reopened}/>));
  expect(query('[data-testid="ui-card-editor"]')).not.toBeNull();
  expect((query('[data-testid="ui-card-editor-summary"]') as HTMLTextAreaElement).value).toBe('앱을 꺼도 남아야 하는 내용');
  expect(document.activeElement?.tagName).not.toMatch(/INPUT|TEXTAREA/);
  await clickControl('ui-card-editor-back');
  expect(query('[data-testid="ui-create-filter-mine"]')?.getAttribute('aria-pressed')).toBe('true');
  await clickControl('ui-tab-library');
  expect((query('[data-testid="ui-library-search-input"]') as HTMLInputElement).value).toBe('서율');
  expect(queryAll('[data-testid^="ui-bot-card-"]')).toHaveLength(1);
});

it('keeps the visible chat screen mounted while a background refresh changes one message', async () => {
  const memory = new ScreenMemory(createScreenStorage());
  memory.updateView(view => ({...view, tab: 'chats'}));
  await memory.flush();
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App memory={memory}/>));
  const page = query('[data-testid="ui-page-chats"]');
  const unchanged = query('[data-testid="ui-chat-row-forest-post"]');
  const previous = memory.getSnapshot().data;
  await act(async () => memory.refresh(async () => ({...previous,
    chats: previous.chats.map((chat, index) => index ? chat : {...chat, lastAssistantMessage: '방금 도착한 내용'})})));
  expect(query('[data-testid="ui-page-chats"]')).toBe(page);
  expect(query('[data-testid="ui-chat-row-forest-post"]')).toBe(unchanged);
  expect(query('[data-testid="ui-chat-message-night-library"]')?.textContent).toBe('방금 도착한 내용');
});

it('searches preview cards and can clear or close search without opening legacy screens', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App/>));
  const search = query('[data-testid="ui-library-search-button"]') as HTMLElement;
  await act(async () => search.click());
  expect(search.getAttribute('aria-expanded')).toBe('true');
  const input = query('[data-testid="ui-library-search-input"]') as HTMLInputElement;
  const type = async (value: string) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', {bubbles: true}));
    });
  };
  await type('서율');
  expect(queryAll('[data-testid^="ui-bot-card-"]')).toHaveLength(1);
  expect(query('[data-testid="ui-bot-card-night-library"]')).not.toBeNull();
  await type('꽃비');
  expect(query('[data-testid="ui-bot-card-glass-garden"]')).not.toBeNull();
  await type('없는 카드');
  expect(queryAll('[data-testid^="ui-bot-card-"]')).toHaveLength(0);
  expect(query('[data-testid="ui-library-no-results"]')).not.toBeNull();
  await act(async () => (query('[aria-label="검색어 지우기"]') as HTMLElement).click());
  expect(input.value).toBe('');
  expect(queryAll('[data-testid^="ui-bot-card-"]')).toHaveLength(12);
  await type('noah');
  expect(query('[data-testid="ui-bot-card-orbit-cafe"]')).not.toBeNull();
  await act(async () => (query('[aria-label="검색 닫기"]') as HTMLElement).click());
  expect(query('input')).toBeNull();
  expect(search.getAttribute('aria-expanded')).toBe('false');
  expect(queryAll('[data-testid^="ui-bot-card-"]')).toHaveLength(12);
  expect(query('[role="dialog"]')).toBeNull();
});

it('opens a creation draft, retains edits when returning, and only adds it to the library on completion', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App/>));
  expect(query('[data-testid="ui-bot-card-draft-1"]')).toBeNull();
  await clickControl('ui-tab-create');
  await clickControl('ui-create-filter-draft');
  expect(queryAll('[data-testid^="ui-creation-row-"]')).toHaveLength(3);
  await clickControl('ui-creation-row-draft-1');
  expect(query('[data-testid="ui-card-editor"]')).not.toBeNull();
  await enterText('ui-card-editor-title', '새로 완성할 이야기');
  await clickControl('ui-card-editor-back');
  expect(query('[data-testid="ui-create-filter-draft"]')?.getAttribute('aria-pressed')).toBe('true');
  expect(query('[data-testid="ui-creation-title-draft-1"]')?.textContent).toBe('새로 완성할 이야기');
  await clickControl('ui-tab-library');
  expect(queryAll('[data-testid^="ui-bot-card-"]')).toHaveLength(12);
  expect(query('[data-testid="ui-bot-card-draft-1"]')).toBeNull();
  await clickControl('ui-tab-create');
  await clickControl('ui-create-search-button');
  await enterText('ui-create-search-input', '새로 완성할');
  expect(queryAll('[data-testid^="ui-creation-row-"]')).toHaveLength(1);
  await clickControl('ui-creation-row-draft-1');
  expect((query('[data-testid="ui-card-editor-title"]') as HTMLTextAreaElement).value).toBe('새로 완성할 이야기');
  await clickControl('ui-card-editor-complete');
  expect(query('[data-testid="ui-card-editor"]')).toBeNull();
  await clickControl('ui-create-filter-all');
  expect(query('[data-testid="ui-creation-summary-draft-1"]')?.textContent).toMatch(/^완성/);
  await clickControl('ui-tab-library');
  expect(query('[data-testid="ui-bot-card-draft-1"]')?.textContent).toContain('새로 완성할 이야기');
});

it('groups external cards for editing while preserving their published versions until completion', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App/>));
  const original = query('[data-testid="ui-bot-card-night-library"]')!.textContent;
  await clickControl('ui-tab-create');
  await clickControl('ui-create-filter-external');
  expect(query('[data-testid="ui-creation-row-draft-1"]')).toBeNull();
  await clickControl('ui-creation-row-night-library');
  expect(query('[data-testid="ui-card-editor-status"]')?.textContent).toContain('외부 카드');
  await enterText('ui-card-editor-title', '외부 카드 편집본');
  await enterText('ui-card-editor-introduction', '새로운 시작 장면');
  await clickControl('ui-card-editor-back');
  await clickControl('ui-tab-library');
  expect(query('[data-testid="ui-bot-card-night-library"]')!.textContent).toBe(original);
  await clickControl('ui-tab-create');
  await clickControl('ui-create-filter-external');
  await clickControl('ui-creation-row-night-library');
  expect((query('[data-testid="ui-card-editor-introduction"]') as HTMLTextAreaElement).value).toBe('새로운 시작 장면');
  await clickControl('ui-card-editor-complete');
  await clickControl('ui-tab-library');
  expect(queryAll('[data-testid="ui-bot-card-night-library"]')).toHaveLength(1);
  expect(query('[data-testid="ui-bot-card-night-library"]')!.textContent).toContain('외부 카드 편집본');
});

it('starts new drafts from the plus button and requires a title to complete them', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<App/>));
  await clickControl('ui-tab-create');
  await clickControl('ui-header-action');
  await clickControl('ui-card-editor-complete');
  expect(query('[role="alert"]')?.textContent).toContain('제목');
  await enterText('ui-card-editor-title', '플러스로 만든 카드');
  await enterText('ui-card-editor-summary', '작성한 소개');
  await clickControl('ui-card-editor-back');
  await clickControl('ui-tab-library');
  expect(query('[data-testid^="ui-bot-card-created-"]')).toBeNull();
  await clickControl('ui-tab-create');
  await clickControl('ui-create-filter-mine');
  const newRow = query('[data-testid^="ui-creation-row-created-"]') as HTMLElement;
  await act(async () => newRow.click());
  expect((query('[data-testid="ui-card-editor-summary"]') as HTMLTextAreaElement).value).toBe('작성한 소개');
  await clickControl('ui-card-editor-complete');
  await clickControl('ui-tab-library');
  expect(query('[data-testid^="ui-bot-card-created-"]')?.textContent).toContain('플러스로 만든 카드');
});
