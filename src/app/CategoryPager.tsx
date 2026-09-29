import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {Keyboard, Platform, ScrollView, View, useWindowDimensions} from 'react-native';
import {PagingLocks} from '../layout/PagingBoundary';
import {useItemReducedMotion} from '../layout/itemListMotion';

type CategoryId = string | null;
type PageRenderer = (id: CategoryId, active: boolean) => ReactNode;

/** Only the card contents page horizontally; the header and category strip stay in place. */
export function CategoryPager({ids, selected, onSelect, enabled, children}: {
  ids: readonly CategoryId[]; selected: CategoryId; onSelect: (id: CategoryId) => void; enabled: boolean;
  children: (pages: (render: PageRenderer) => ReactNode) => ReactNode;
}) {
  const {width} = useWindowDimensions();
  const pager = useRef<ScrollView>(null);
  const offset = useRef(0);
  const dragging = useRef(false);
  const touching = useRef(false);
  const swiped = useRef<CategoryId | undefined>(undefined);
  const commanded = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useItemReducedMotion();
  const locks = useRef(new Set<symbol>()).current;
  const touchLocks = useRef(new Set<symbol>()).current;
  const [locked, setLocked] = useState(false);
  const index = Math.max(0, ids.indexOf(selected));
  const latest = useRef({enabled, ids, selected, index, width, onSelect});
  latest.current = {enabled, ids, selected, index, width, onSelect};
  const syncLocks = useCallback(() => {
    const blocked = locks.size + touchLocks.size > 0;
    // Apply before the next native MOVE, including touches on the pill strip.
    if (Platform.OS !== 'web') pager.current?.setNativeProps({scrollEnabled: latest.current.enabled && !blocked});
    setLocked(blocked);
  }, [locks, touchLocks]);
  const setLock = useCallback((id: symbol, blocked: boolean, touch = false) => {
    const set = touch ? touchLocks : locks;
    if (blocked) set.add(id); else set.delete(id);
    syncLocks();
  }, [locks, touchLocks, syncLocks]);
  const releaseTouchLocks = useCallback(() => {if (touchLocks.size) {touchLocks.clear(); syncLocks();}}, [touchLocks, syncLocks]);
  const clearTimer = useCallback(() => {if (timer.current) clearTimeout(timer.current); timer.current = null;}, []);
  useEffect(() => {
    // Committing a native swipe must not issue a new scroll command or cancel
    // a second drag that has already started during the previous settlement.
    if (swiped.current === selected && enabled) {swiped.current = undefined; return;}
    swiped.current = undefined;
    clearTimer(); dragging.current = false;
    const x = index * width;
    if (Math.abs(offset.current - x) > 1) {
      commanded.current = x;
      pager.current?.scrollTo({x, animated: enabled && !reduced && Math.abs(offset.current - x) <= width + 1});
    } else commanded.current = null;
  }, [selected, index, width, ids.length, enabled, reduced, clearTimer]);
  useEffect(() => clearTimer, [clearTimer]);
  const settle = () => {
    clearTimer();
    const current = latest.current;
    if (touching.current || !dragging.current || !current.enabled || locks.size || touchLocks.size) return;
    dragging.current = false;
    const next = Math.max(0, Math.min(current.ids.length - 1, Math.round(offset.current / current.width)));
    const id = current.ids[next] ?? null;
    if (id !== current.selected) {swiped.current = id; Keyboard.dismiss(); current.onSelect(id);}
  };
  const pages = (render: PageRenderer) => <ScrollView ref={pager} testID="category-pager" horizontal pagingEnabled directionalLockEnabled
    bounces={false} overScrollMode="never" scrollEnabled={enabled && !locked} showsHorizontalScrollIndicator={false}
    keyboardShouldPersistTaps="handled" scrollEventThrottle={16} style={{flex: 1}} contentContainerStyle={{height: '100%'}}
    onTouchStart={() => {touching.current = true; clearTimer();}}
    onTouchEnd={() => {touching.current = false; if (dragging.current) {clearTimer(); timer.current = setTimeout(settle, 100);}}}
    onTouchCancel={() => {if (Platform.OS === 'web') touching.current = false;}}
    onScrollBeginDrag={() => {clearTimer(); touching.current = true; commanded.current = null; dragging.current = true; Keyboard.dismiss();}}
    onScrollEndDrag={event => {touching.current = false; offset.current = event.nativeEvent.contentOffset.x; clearTimer(); timer.current = setTimeout(settle, 100);}}
    onMomentumScrollBegin={clearTimer}
    onScroll={event => {
      offset.current = event.nativeEvent.contentOffset.x;
      if (commanded.current !== null) {
        if (Math.abs(offset.current - commanded.current) < 1) commanded.current = null;
        return;
      }
      if (Platform.OS === 'web') {
        dragging.current = true;
        clearTimer(); timer.current = setTimeout(settle, 100);
      }
    }}
    onMomentumScrollEnd={event => {offset.current = event.nativeEvent.contentOffset.x; settle();}}>
    {ids.map((id, pageIndex) => <View key={id ?? 'all'} testID={`category-page-${id ?? 'all'}`}
      pointerEvents={pageIndex === index ? 'auto' : 'none'} aria-hidden={pageIndex !== index}
      accessibilityElementsHidden={pageIndex !== index} importantForAccessibility={pageIndex === index ? 'auto' : 'no-hide-descendants'}
      style={{width, height: '100%'}}>
      {Math.abs(pageIndex - index) <= 1 && render(id, pageIndex === index)}
    </View>)}
  </ScrollView>;
  return <PagingLocks.Provider value={setLock}><View style={{flex: 1}}
    onStartShouldSetResponderCapture={() => {releaseTouchLocks(); return false;}}
    onTouchEnd={event => {if (!event.nativeEvent.touches.length) releaseTouchLocks();}}>
    {children(pages)}
  </View></PagingLocks.Provider>;
}
