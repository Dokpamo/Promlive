import type {ScreenView} from '../screenState';
import type {Tab} from '../navigationRoutes';
import {desktopMetrics} from './desktopMetrics';

export const desktopRailWidth = desktopMetrics.rail;
export const isDesktopLayout = (platform: string, width: number) =>
  platform === 'macos' || platform === 'windows' || (platform === 'web' && width >= 800);

export function desktopLayout(width: number) {
  const content = Math.max(1, width - desktopRailWidth);
  return {content, split: content >= 820, chatList: content >= 1060 ? 320 : 280,
    settingsList: 204, preview: content >= 940 ? 280 : 0,
    columns: Math.max(1, Math.min(6, Math.floor((content - 36) / 180)))};
}

/** A mobile snapshot can contain a detail route above a different root tab. */
export function desktopActiveTab(view: ScreenView): Tab {
  if (view.openedCardId) return 'create';
  if (view.chatId) return 'chats';
  if (view.detailCardId) return 'library';
  return view.tab;
}

export function desktopTabView(view: ScreenView, tab: Tab): ScreenView {
  if (desktopActiveTab(view) === tab) return view;
  return {...view, tab, openedCardId: null, detailCardId: null, chatId: null, coverOpen: false, galleryIndex: null};
}
