import {useCallback, useRef, type RefObject} from 'react';
import type {LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView} from 'react-native';
import type {ScreenMemory} from './ScreenMemory';
import type {ScrollScope} from './screenState';

/** ScrollView counterpart of the list/header restoration, for settings and the editor. */
export function usePlainScrollMemory(memory: ScreenMemory, scope: ScrollScope, scroll: RefObject<ScrollView | null>) {
  const saved = useRef(memory.getScroll(scope)).current;
  const contentOffset = useRef({x: 0, y: saved.offset}).current;
  const pending = useRef(saved.offset > 0);
  const dimensions = useRef({content: 0, viewport: 0});
  const restore = useCallback(() => {
    const {content, viewport} = dimensions.current;
    if (!pending.current || content <= 0 || viewport <= 0) return;
    pending.current = false;
    scroll.current?.scrollTo({y: Math.min(saved.offset, Math.max(0, content - viewport)), animated: false});
  }, [saved.offset, scroll]);
  return {
    contentOffset, scrollEventThrottle: 32,
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
