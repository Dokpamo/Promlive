// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import {usePlainScrollMemory} from '../src/ui/usePlainScrollMemory';
import type {ScreenMemoryController} from '../src/ui/ScreenMemory';

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
it('advances a virtualized tail before loading more, preserving the saved position until it fits', async () => {
  const rememberScroll = vi.fn(), scrollTo = vi.fn(), loadMore = vi.fn(async () => {});
  const memory = {getScroll: () => ({offset: 5000, hidden: 0, height: 0, maxOffset: 9000}), rememberScroll} as unknown as ScreenMemoryController;
  const scroll = {current: {scrollTo, scrollToEnd: vi.fn()}}, paging = {hasMore: true, loading: true, loadMore};
  let events!: ReturnType<typeof usePlainScrollMemory>;
  function Probe() {events = usePlainScrollMemory(memory, 'chats', scroll, paging); return null;}
  const host = document.createElement('div'), root = createRoot(host);
  try {
    await act(async () => root.render(<Probe/>));
    events.onLayout({nativeEvent: {layout: {height: 800}}} as never);
    events.onContentSizeChange(400, 2000);
    expect(scrollTo).toHaveBeenLastCalledWith({y: 1200, animated: false});
    expect(loadMore).toHaveBeenCalledTimes(1);
    events.onContentSizeChange(400, 2000);
    expect(loadMore).toHaveBeenCalledTimes(1);
    events.onScroll({nativeEvent: {contentOffset: {y: 1200}, contentSize: {height: 2000}, layoutMeasurement: {height: 800}}} as never);
    expect(rememberScroll).not.toHaveBeenCalled();
    events.onContentSizeChange(400, 6000);
    expect(scrollTo).toHaveBeenLastCalledWith({y: 5000, animated: false});
    events.onScroll({nativeEvent: {contentOffset: {y: 5000}, contentSize: {height: 6000}, layoutMeasurement: {height: 800}}} as never);
    expect(rememberScroll).toHaveBeenLastCalledWith('chats', {offset: 5000, maxOffset: 5200, hidden: 0, height: 0});
  } finally {await act(async () => root.unmount());}
});
