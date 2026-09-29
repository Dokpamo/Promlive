import {createContext, useContext, useLayoutEffect, useRef, type ReactNode} from 'react';
import {View, type ScrollViewProps} from 'react-native';

export const PagingLocks = createContext<((id: symbol, locked: boolean, touch?: boolean) => void) | null>(null);

export function usePagingLock(locked: boolean) {
  const update = useContext(PagingLocks);
  const id = useRef(Symbol('paging-lock')).current;
  useLayoutEffect(() => {
    update?.(id, locked);
    return () => update?.(id, false);
  }, [id, locked, update]);
}

/** Native scroll takeover cancels JS touches; keep ownership until lift-off or the next touch. */
export function PagingBoundary({children}: {children: (scroll: Pick<ScrollViewProps, 'onScrollBeginDrag' | 'onScrollEndDrag'>) => ReactNode}) {
  const update = useContext(PagingLocks);
  const id = useRef(Symbol('paging-touch')).current;
  useLayoutEffect(() => () => update?.(id, false, true), [id, update]);
  const begin = () => update?.(id, true, true);
  const end = () => update?.(id, false, true);
  return <View onStartShouldSetResponderCapture={() => {update?.(id, true, true); return false;}}
    onTouchStart={begin} onTouchEnd={event => {if (!event.nativeEvent.touches.length) end();}}>
    {children({onScrollBeginDrag: begin, onScrollEndDrag: end})}
  </View>;
}
