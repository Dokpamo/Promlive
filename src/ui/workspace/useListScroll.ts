import {useRef} from 'react';
import type {FlatList} from 'react-native';

export type ScrollController = {scrollTo(options: {y: number; animated?: boolean}): void; scrollToEnd(options?: {animated?: boolean}): void};
/** Keep the existing keyboard/chrome/motion controllers independent of list implementation. */
export function useListScroll<T>() {
  const list = useRef<FlatList<T>>(null);
  const scroll = useRef<ScrollController>({scrollTo: options => list.current?.scrollToOffset({offset: options.y, animated: options.animated ?? false}),
    // FlatList.scrollToEnd estimates the final row and omits content-container
    // padding. The underlying ScrollView already knows the actual bottom.
    scrollToEnd: options => (list.current?.getScrollResponder() as unknown as ScrollController | null)?.scrollToEnd(options)});
  return {list, scroll};
}
