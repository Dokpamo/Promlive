import {useCallback, useEffect, useRef, type RefObject} from 'react';
import type {LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent} from 'react-native';
import type {ScrollController} from './workspace/useListScroll';
import type {ScreenMemoryController as ScreenMemory} from './ScreenMemory';
import type {ScrollScope} from './screenState';
import {useCollectionProbe} from './workspace/probe';

/** ScrollView counterpart of list/header restoration, including detail and editor views. */
export function usePlainScrollMemory(memory: ScreenMemory, scope: ScrollScope, scroll: RefObject<ScrollController | null>, paging?: {hasMore: boolean; loading?: boolean; loadMore?: (() => Promise<void>) | undefined}) {
  const page = useRef(paging); page.current = paging;
  const saved = useRef(memory.getScroll(scope)).current;
  const contentOffset = useRef({x: 0, y: saved.offset}).current;
  const pending = useRef(saved.offset > 0), requestedHeight = useRef(-1);
  const dimensions = useRef({content: 0, viewport: 0});
  useCollectionProbe(scope, () => ({...dimensions.current, offset: memory.getScroll(scope).offset,
    height: dimensions.current.viewport, restoring: pending.current, hasNewer: !!page.current?.hasMore, hasOlder: false, loading: !!page.current?.loading}),
    pixels => scroll.current?.scrollTo({y: Math.max(0, Math.min(dimensions.current.content - dimensions.current.viewport, memory.getScroll(scope).offset + pixels)), animated: false}));
  const restore = useCallback(() => {
    const {content, viewport} = dimensions.current;
    if (!pending.current || content <= 0 || viewport <= 0) return;
    scroll.current?.scrollTo({y: Math.min(saved.offset, Math.max(0, content - viewport)), animated: false});
    if (saved.offset > content - viewport && page.current?.hasMore && page.current.loadMore) {
      if (requestedHeight.current !== content) {requestedHeight.current = content; void page.current.loadMore();}
      return;
    }
    pending.current = false;
  }, [saved.offset, scroll]);
  useEffect(() => {if (pending.current && !paging?.loading) {
    const frame = requestAnimationFrame(restore); return () => cancelAnimationFrame(frame);
  }}, [paging?.hasMore, paging?.loading, restore]);
  return {
    contentOffset, scrollEventThrottle: 32,
    onScrollBeginDrag: () => {pending.current = false;},
    onLayout: (event: LayoutChangeEvent) => {dimensions.current.viewport = event.nativeEvent.layout.height; restore();},
    onContentSizeChange: (_width: number, height: number) => {dimensions.current.content = height; restore();},
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pending.current) return;
      const {contentOffset: offset, contentSize, layoutMeasurement} = event.nativeEvent;
      const maxOffset = Math.max(0, contentSize.height - layoutMeasurement.height);
      memory.rememberScroll(scope, {offset: Math.max(0, Math.min(offset.y, maxOffset)), maxOffset, hidden: 0, height: 0});
    },
  };
}
