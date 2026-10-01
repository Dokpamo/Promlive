// @vitest-environment jsdom
import {act, createRef, useContext, type ContextType, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {BodyPageContext} from '../src/ui/BodyMotion';
import {SwipeContext} from '../src/ui/SwipeSurface';
import {TabPages, type RootPageHandle} from '../src/ui/TabPages';
import {rootPages, type RootPageKey} from '../src/ui/swipeNavigation';
import {initialScreenView, type ScreenView} from '../src/ui/screenState';

vi.mock('react-native', () => vi.importActual('react-native-web'));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => {document.body.replaceChildren(); vi.restoreAllMocks();});

it('keeps the arrived body painted through a delayed React selection commit in both directions', async () => {
  const view = {...initialScreenView(), tab: 'create' as const, creationFilter: 'all' as const};
  const attached = new Map<RootPageKey, NonNullable<ContextType<typeof BodyPageContext>['translateX']>>();
  let gesture: NonNullable<ContextType<typeof SwipeContext>>;
  function Body() {
    const page = useContext(BodyPageContext);
    gesture = useContext(SwipeContext)!;
    // Retain exactly the first graph a native body is attached to.
    if (!attached.has(page.key)) attached.set(page.key, page.translateX!);
    return null;
  }
  const pages = Object.fromEntries(rootPages.map(page => [page.key, <Body key={page.key}/>])) as Record<RootPageKey, ReactNode>;
  const handle = createRef<RootPageHandle>();
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const x = (key: RootPageKey) => (attached.get(key) as unknown as {__getValue(): number}).__getValue();
  const render = (next: ScreenView) =>
    root.render(<TabPages ref={handle} view={next} pages={pages} width={412} enabled onStep={() => {}}/>);
  try {
    await act(async () => render(view));
    const draft = {...view, creationFilter: 'draft' as const};
    // Native animation reaches the neighboring body; JS/React can arrive later.
    await act(async () => gesture!.translation.setValue(-412));
    expect(x('create:draft')).toBe(0);
    await act(async () => handle.current!.prepare(draft));
    expect(x('create:draft')).toBe(0);
    expect(x('create:all')).toBe(-412);
    await act(async () => render(draft));
    expect(x('create:draft')).toBe(0);

    await act(async () => gesture!.translation.setValue(412));
    expect(x('create:all')).toBe(0);
    await act(async () => handle.current!.prepare(view));
    expect(x('create:all')).toBe(0);
    expect(x('create:draft')).toBe(412);
    await act(async () => render(view));
    expect(x('create:all')).toBe(0);

    // Directly tapping a nonadjacent pill must prepare its native body before render too.
    for (const filter of ['external', 'mine', 'ready', 'all'] as const) {
      const next = {...view, creationFilter: filter};
      await act(async () => handle.current!.prepare(next));
      expect(x(`create:${filter}`)).toBe(0);
      await act(async () => render(next));
      expect(x(`create:${filter}`)).toBe(0);
    }
  } finally {await act(async () => root.unmount());}
});
