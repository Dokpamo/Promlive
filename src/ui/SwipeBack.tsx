import {useEffect, useRef, type ReactNode} from 'react';
import {Animated, Platform, StyleSheet, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {HorizontalGesture} from './HorizontalGesture';
import {useSwipeMotion} from './useSwipeMotion';
import {usePalette} from './Theme';
import type {GestureBlockRef} from './HorizontalGesture.types';
import type {BackTransition} from './backTransition';
import {useDesktopPane} from './desktop/DesktopPane';

/** The previous route stays mounted underneath, including its exact scroll position. */
type Props = {
  children: ReactNode; identity: string; enabled?: boolean; onBack: () => void;
  dismiss?: boolean;
  blockers?: GestureBlockRef[];
  transition: BackTransition;
  drawBehindStatusBar?: boolean;
  backgroundColor?: string;
};
export function SwipeBack(props: Props) {
  const pane = useDesktopPane();
  return pane ? <DesktopBack {...props}/> : <MobileSwipeBack {...props}/>;
}
function DesktopBack({children, dismiss, onBack, backgroundColor}: Props) {
  const colors = usePalette();
  const callback = useRef(onBack); callback.current = onBack;
  useEffect(() => {if (dismiss) callback.current();}, [dismiss]);
  return <View style={{flex: 1, minHeight: 0, backgroundColor: backgroundColor ?? colors.background}}>{children}</View>;
}
function MobileSwipeBack({children, identity, enabled = true, dismiss = false, onBack, blockers, transition, drawBehindStatusBar = false, backgroundColor: background}: Props) {
  const colors = usePalette();
  const backgroundColor = background ?? colors.background;
  const {width} = useWindowDimensions();
  const safe = useSafeAreaInsets();
  const motion = useSwipeMotion({identity, width, previous: true, next: false, enabled, dismiss, onStep: onBack,
    source: transition.translation, release: 'back', entrance: transition});
  return <HorizontalGesture translation={motion.translation} enabled={motion.enabled} rightOnly
    {...(blockers ? {blockers} : {})}
    onStart={motion.onStart} onRelease={motion.onRelease} testID="ui-back-swipe">
    <Animated.View testID="ui-back-motion" pointerEvents={dismiss ? 'none' : 'auto'}
      {...(Platform.OS === 'web' ? {inert: dismiss} : {})}
      style={[styles.frame, {transform: [{translateX: motion.translateX}]}]}>
      <Animated.View pointerEvents="none" accessible={false} testID="ui-back-shadow"
        style={[StyleSheet.absoluteFillObject, styles.shadow, transition.corners, {backgroundColor, opacity: transition.shadowOpacity}]}/>
      <Animated.View testID="ui-back-page" style={[styles.page, transition.corners, {backgroundColor}]}>
        <View testID="ui-back-safe-content" style={{flex: 1, minHeight: 0,
          paddingTop: drawBehindStatusBar ? 0 : safe.top, paddingLeft: safe.left, paddingRight: safe.right}}>{children}</View>
      </Animated.View>
    </Animated.View>
  </HorizontalGesture>;
}
const curve = Platform.OS === 'ios' ? {borderCurve: 'continuous' as const} : {};
const styles = StyleSheet.create({
  frame: {flex: 1, minHeight: 0},
  page: {flex: 1, minHeight: 0, overflow: 'hidden', ...curve},
  shadow: {...curve,
    ...Platform.select({ios: {shadowColor: '#000', shadowOffset: {width: -2, height: 0}, shadowRadius: 9, shadowOpacity: 0.1},
      default: {boxShadow: '-2px 0px 14px rgba(0, 0, 0, 0.1)'}})},
});
