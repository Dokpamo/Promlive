import {Animated} from 'react-native';
import type {ScreenView} from './screenState';
import {rootPageKey, rootPages, stepRootView, type RootPageKey} from './swipeNavigation';

/** Stable native slots: React selection never moves a page ahead of its transform. */
export function createRootPageLayout(initial: ScreenView, initialWidth: number) {
  function positions(view: ScreenView, width: number) {
    const key = rootPageKey(view);
    const previous = rootPageKey(stepRootView(view, -1)), next = rootPageKey(stepRootView(view, 1));
    return rootPages.map(item => {
      const active = item.key === key;
      const neighbor = !active && (item.key === previous || item.key === next);
      const filter = neighbor && item.tab === view.tab;
      const adjacent = item.key === previous ? -width : width;
      return {key: item.key, page: active || filter ? 0 : neighbor ? adjacent : width * 3,
        body: filter ? adjacent : 0, visible: active || neighbor ? 1 : 0,
        header: active || item.tab !== view.tab ? 1 : 0};
    });
  }
  const slots = Object.fromEntries(positions(initial, initialWidth).map(item => [item.key, {
    page: new Animated.Value(item.page), body: new Animated.Value(item.body),
    visible: new Animated.Value(item.visible), header: new Animated.Value(item.header),
  }])) as Record<RootPageKey, {page: Animated.Value; body: Animated.Value; visible: Animated.Value; header: Animated.Value}>;
  return {slots, select(view: ScreenView, width: number) {
    for (const item of positions(view, width)) {
      const slot = slots[item.key];
      slot.page.setValue(item.page); slot.body.setValue(item.body);
      slot.visible.setValue(item.visible); slot.header.setValue(item.header);
    }
  }};
}
