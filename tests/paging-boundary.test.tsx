// @vitest-environment jsdom
import {act, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import {PagingBoundary, PagingLocks} from '../src/layout/PagingBoundary';
import type {NativeScrollEvent, NativeSyntheticEvent} from 'react-native';

vi.mock('react-native', () => ({View: ({children, onTouchStart, onTouchCancel}: {children: ReactNode; onTouchStart?: () => void; onTouchCancel?: () => void}) =>
  <div data-testid="boundary" onTouchStart={onTouchStart} onTouchCancel={onTouchCancel}>{children}</div>}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

it('keeps the page locked when native scrolling cancels JS touches, then releases on native finger lift', async () => {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container), update = vi.fn();
  const event = {} as NativeSyntheticEvent<NativeScrollEvent>;
  try {
    await act(async () => root.render(<PagingLocks.Provider value={update}><PagingBoundary>{scroll => <>
      <button onClick={() => scroll.onScrollBeginDrag?.(event)}>native start</button>
      <button onClick={() => scroll.onScrollEndDrag?.(event)}>native end</button>
    </>}</PagingBoundary></PagingLocks.Provider>));
    const boundary = container.querySelector('[data-testid="boundary"]')!;
    await act(async () => boundary.dispatchEvent(new Event('touchstart', {bubbles: true})));
    expect(update.mock.lastCall?.slice(1)).toEqual([true, true]);
    await act(async () => boundary.dispatchEvent(new Event('touchcancel', {bubbles: true})));
    expect(update.mock.lastCall?.slice(1)).toEqual([true, true]);
    await act(async () => container.querySelectorAll('button')[0]!.click());
    expect(update.mock.lastCall?.slice(1)).toEqual([true, true]);
    await act(async () => container.querySelectorAll('button')[1]!.click());
    expect(update.mock.lastCall?.slice(1)).toEqual([false, true]);
  } finally {await act(async () => root.unmount()); container.remove();}
});
