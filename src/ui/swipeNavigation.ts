import {tabs, type Tab} from './navigationRoutes';
import {creationFilters} from './creationPreview';
import type {LibraryFilter, ScreenView} from './screenState';

export const libraryFilters = [
  {id: 'all', label: '전체'},
  {id: 'recent', label: '요즘 한 거'},
  {id: 'idle', label: '방치 중'},
] as const;
export type SwipeDirection = -1 | 1; // Previous / next, opposite to finger travel.
export type RootPageKey = `library:${LibraryFilter}` | `create:${ScreenView['creationFilter']}` | 'chats' | 'settings';
export const rootPages: readonly {key: RootPageKey; tab: Tab}[] = [
  ...libraryFilters.map(filter => ({key: `library:${filter.id}` as const, tab: 'library' as const})),
  {key: 'chats', tab: 'chats'},
  ...creationFilters.map(filter => ({key: `create:${filter.id}` as const, tab: 'create' as const})),
  {key: 'settings', tab: 'settings'},
];

export function rootPageKey(view: ScreenView, tab = view.tab): RootPageKey {
  if (tab === 'library') return `library:${view.libraryFilter}`;
  if (tab === 'create') return `create:${view.creationFilter}`;
  return tab;
}

/** Filters take precedence; crossing a tab boundary restores that tab's last filter. */
export function stepRootView(view: ScreenView, direction: SwipeDirection): ScreenView {
  if (view.tab === 'library') {
    const filter = libraryFilters[libraryFilters.findIndex(item => item.id === view.libraryFilter) + direction];
    if (filter) return {...view, libraryFilter: filter.id};
  } else if (view.tab === 'create') {
    const filter = creationFilters[creationFilters.findIndex(item => item.id === view.creationFilter) + direction];
    if (filter) return {...view, creationFilter: filter.id};
  }
  const tab = tabs[tabs.indexOf(view.tab) + direction];
  return tab ? {...view, tab} : view;
}

/** A deliberate drag or a short, fast flick; pulling back cancels the transition. */
export function swipeDestination(x: number, velocity: number, width: number, previous: boolean, next: boolean): SwipeDirection | null {
  if (width <= 0 || !Number.isFinite(x) || !Number.isFinite(velocity)) return null;
  const direction = x > 0 ? -1 : 1;
  if ((direction === -1 && !previous) || (direction === 1 && !next)) return null;
  if (x * velocity < 0 && Math.abs(velocity) > 180) return null;
  const distance = Math.abs(x);
  return distance >= width * 0.28 || (distance >= 24 && Math.abs(velocity) >= 650 && x * velocity > 0) ? direction : null;
}
