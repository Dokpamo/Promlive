import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, Easing, Platform} from 'react-native';
import {panelSpringForDistance} from './panelAnimation';

export function useItemReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {if (mounted) setReduced(value);});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {mounted = false; subscription.remove();};
  }, []);
  return reduced;
}

/** Layout and opacity share one clock, and can reverse without waiting for an exit. */
export function useItemPresence(active: boolean, reduced: boolean, nativeDriver = false) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;
  const [present, setPresent] = useState(active);
  useLayoutEffect(() => {
    if (active) setPresent(true);
    progress.stopAnimation();
    if (reduced) {progress.setValue(active ? 1 : 0); setPresent(active); return;}
    const animation = Animated.timing(progress, {
      toValue: active ? 1 : 0, duration: active ? 280 : 220,
      easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver && Platform.OS !== 'web',
    });
    animation.start(({finished}) => {if (finished && !active) setPresent(false);});
    return () => animation.stop();
  }, [active, nativeDriver, progress, reduced]);
  return {progress, present: active || present};
}

export interface ListItem {id: string; title: string; pinnedAt?: number | null | undefined}

export type ItemLayout<T extends ListItem> =
  | {key: string; kind: 'item'; item: T; top: number; height: number}
  | {key: 'pin-divider'; kind: 'divider'; visible: boolean; top: number; height: number};

/** Keep the separator mounted at zero height so its disappearance can also animate. */
export function itemListLayout<T extends ListItem>(items: readonly T[], rowHeight: number, dividerHeight: number): ItemLayout<T>[] {
  const firstUnpinned = items.findIndex(item => item.pinnedAt == null);
  const dividerIndex = firstUnpinned < 0 ? items.length : firstUnpinned;
  const visible = dividerIndex > 0 && dividerIndex < items.length;
  const rows: ItemLayout<T>[] = [];
  let top = 0;
  for (let index = 0; index <= items.length; index++) {
    if (index === dividerIndex) {
      const height = visible ? dividerHeight : 0;
      rows.push({key: 'pin-divider', kind: 'divider', visible, top, height});
      top += height;
    }
    const item = items[index];
    if (item) {rows.push({key: item.id, kind: 'item', item, top, height: rowHeight}); top += rowHeight;}
  }
  return rows;
}

/** FLIP the visual position while FlatList keeps stable keys and row measurements. */
export function useItemRowOffset(top: number, resetKey: string, reduced: boolean) {
  const offset = useRef(new Animated.Value(0)).current;
  const previous = useRef({top, resetKey});
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = {top, resetKey};
    if (reduced || before.resetKey !== resetKey) {offset.stopAnimation(); offset.setValue(0); return;}
    const delta = before.top - top;
    if (!delta) return;
    // JS-driven offsets are read synchronously, including halfway through a reorder.
    offset.stopAnimation(value => {
      offset.setValue(value + delta);
      Animated.spring(offset, {...panelSpringForDistance(), toValue: 0, useNativeDriver: false}).start();
    });
  }, [offset, reduced, resetKey, top]);
  useEffect(() => () => offset.stopAnimation(), [offset]);
  return offset;
}
