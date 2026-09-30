import {useMemo} from 'react';
import {Animated} from 'react-native';
import {PanGestureHandler, State, type PanGestureHandlerStateChangeEvent} from 'react-native-gesture-handler';
import type {HorizontalGestureProps} from './HorizontalGesture.types';

/** Installed RNGH 2 adapter: finger movement drives native transforms without JS frames. */
export function HorizontalGesture({children, translation, enabled, rightOnly, blockers, onStart, onRelease, testID}: HorizontalGestureProps) {
  const event = useMemo(() => Animated.event([{nativeEvent: {translationX: translation}}], {useNativeDriver: true}), [translation]);
  function stateChanged({nativeEvent: state}: PanGestureHandlerStateChangeEvent) {
    if (state.state === State.ACTIVE) onStart();
    if (state.oldState === State.ACTIVE && state.state !== State.ACTIVE) {
      onRelease(state.translationX, state.velocityX, state.state !== State.END);
    }
  }
  return <PanGestureHandler enabled={enabled} activeOffsetX={rightOnly ? 14 : [-14, 14]}
    {...(blockers ? {waitFor: blockers} : {})}
    {...(rightOnly ? {failOffsetX: -10} : {})} failOffsetY={[-10, 10]} maxPointers={1}
    onGestureEvent={event} onHandlerStateChange={stateChanged} cancelsTouchesInView>
    <Animated.View testID={testID} collapsable={false} style={{flex: 1, minHeight: 0}}>{children}</Animated.View>
  </PanGestureHandler>;
}
