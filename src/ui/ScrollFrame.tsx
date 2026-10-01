import {themedStyles} from './Theme';
import {useContext, useEffect, useLayoutEffect, type ReactNode} from 'react';
import {Animated, StyleSheet, View} from 'react-native';
import type {useScrollHeader} from './useScrollHeader';
import {SwipeSurface} from './SwipeSurface';
import {BodyMotionContext, BodyPageContext} from './BodyMotion';

/** The header is a sibling of the native scroll view, outside its edge-effect canvas. */
export function ScrollFrame({scope, header, scrolling, children}: {
  scope: 'library' | 'chats' | 'create';
  header: ReactNode;
  scrolling: ReturnType<typeof useScrollHeader>;
  children: ReactNode;
}) {
  const styles = useStyles();
  const motion = useContext(BodyMotionContext);
  const {key: page, translateX, headerOpacity, headerVisible} = useContext(BodyPageContext);
  const holdHeader = scrolling.holdForHorizontalGesture;
  const registerHeader = motion?.registerHeader;
  const {readHidden, adoptHidden} = scrolling;
  useLayoutEffect(() => registerHeader?.(page, {readHidden, adoptHidden}), [registerHeader, page, readHidden, adoptHidden]);
  useEffect(() => {holdHeader(motion?.moving ?? false);}, [holdHeader, motion?.moving]);
  return <View testID={`ui-${scope}-scroll-frame`} style={styles.frame}>
    <SwipeSurface testID={`ui-${scope}-swipe`}>
      <View testID={`ui-${scope}-body-position`} style={StyleSheet.absoluteFillObject}>
        <Animated.View testID={`ui-${scope}-moving-body`} style={[styles.body, {transform: [{translateX: translateX ?? motion?.translateX ?? 0}]}]}>{children}</Animated.View>
      </View>
    </SwipeSurface>
    <Animated.View testID={`ui-${scope}-header-visibility`} pointerEvents={headerVisible ? 'box-none' : 'none'}
      style={[styles.headerPosition, {opacity: headerOpacity ?? (headerVisible ? 1 : 0)}]}>
      <Animated.View testID={`ui-${scope}-scroll-header`} onLayout={scrolling.onHeaderLayout}
        {...scrolling.headerGestureProps} style={[styles.header, scrolling.headerStyle]}>
        <View pointerEvents="none" style={styles.headerBackground}/>
        {header}
      </Animated.View>
    </Animated.View>
  </View>;
}

const useStyles = themedStyles(colors => ({
  frame: {flex: 1, minHeight: 0, overflow: 'hidden'},
  body: {flex: 1, minHeight: 0},
  headerPosition: {position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1},
  header: {backgroundColor: colors.background},
  // Hide fractional-pixel compositing of stretched content along the header's edge.
  headerBackground: {position: 'absolute', top: 0, left: 0, right: 0, bottom: -StyleSheet.hairlineWidth, backgroundColor: colors.background},
}));
