import type {ReactNode} from 'react';
import {Animated, StyleSheet, View} from 'react-native';
import type {useScrollHeader} from './useScrollHeader';
import {colors} from './tokens';

/** The header is a sibling of the native scroll view, outside its edge-effect canvas. */
export function ScrollFrame({scope, header, scrolling, children}: {
  scope: 'library' | 'chats' | 'create';
  header: ReactNode;
  scrolling: ReturnType<typeof useScrollHeader>;
  children: ReactNode;
}) {
  return <View testID={`ui-${scope}-scroll-frame`} style={styles.frame}>
    {children}
    <Animated.View testID={`ui-${scope}-scroll-header`} onLayout={scrolling.onHeaderLayout}
      {...scrolling.headerGestureProps} style={[styles.header, scrolling.headerStyle]}>
      <View pointerEvents="none" style={styles.headerBackground}/>
      {header}
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  frame: {flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: colors.background},
  header: {position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1, backgroundColor: colors.background},
  // Hide fractional-pixel compositing of stretched content along the header's edge.
  headerBackground: {position: 'absolute', top: 0, left: 0, right: 0, bottom: -StyleSheet.hairlineWidth, backgroundColor: colors.background},
});
