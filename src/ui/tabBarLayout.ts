import {createContext, useContext} from 'react';
import {navigation} from './tokens';

/** Extra scrollable space only for root pages underneath the floating iOS bar. */
export const TabBarContentInset = createContext(0);
export const useTabBarContentInset = () => useContext(TabBarContentInset);

export function tabBarLayout(platform: string, width: number, scale: number, safeBottom: number) {
  if (platform !== 'ios') {
    return {floating: false, height: Math.max(48, navigation.tabHeight * scale),
      bottom: safeBottom, width, contentInset: 0};
  }
  const height = 56;
  // Keep the capsule above the home indicator without stacking its entire safe area
  // beneath the buttons. Home-button devices need only a small outer margin.
  const bottom = safeBottom > 0 ? Math.max(16, safeBottom - 14) : 8;
  return {floating: true, height, bottom, width: Math.min(286, width - 44),
    contentInset: height + bottom + 12};
}

export type TabBarLayout = ReturnType<typeof tabBarLayout>;
