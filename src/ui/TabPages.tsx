import type {ReactNode} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import {tabs, type Tab} from './Navigation';
import {colors} from './tokens';

/** Lay out native pages once; switching tabs only changes which page is visible. */
export function TabPages({tab, pages}: {tab: Tab; pages: Record<Tab, ReactNode>}) {
  return <View style={styles.frame}>
    {tabs.map(item => {
      const active = item === tab;
      return <View key={item} testID={`ui-page-${item}`} aria-hidden={!active}
        accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
        pointerEvents={active ? 'auto' : 'none'}
        style={[styles.page, {opacity: active ? 1 : 0, zIndex: active ? 1 : 0},
          // display:none also removes inactive web inputs from keyboard navigation.
          Platform.OS === 'web' && !active && styles.hidden]}>
        {pages[item]}
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  frame: {flex: 1, minHeight: 0, overflow: 'hidden'},
  page: {...StyleSheet.absoluteFillObject, overflow: 'hidden', backgroundColor: colors.background},
  hidden: {display: 'none'},
});
