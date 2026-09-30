import {useMemo, useRef} from 'react';
import {PanResponder, Platform, View, type ViewStyle} from 'react-native';
import type {HorizontalGestureProps} from './HorizontalGesture.types';

/** Desktop/web fallback. Mobile uses the native gesture → Animated event adapter. */
export function HorizontalGesture(props: HorizontalGestureProps) {
  const current = useRef(props); current.current = props;
  const rejected = useRef(false);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: event => {
      const target = event.target as unknown as {closest?: (selector: string) => unknown};
      rejected.current = !!target.closest?.('input, textarea, [contenteditable="true"]');
      return false;
    },
    onMoveShouldSetPanResponderCapture: (_event, gesture) => {
      if (Math.abs(gesture.dy) > 10 && Math.abs(gesture.dy) >= Math.abs(gesture.dx)) rejected.current = true;
      if (gesture.numberActiveTouches > 1) rejected.current = true;
      return current.current.enabled && !rejected.current && Math.abs(gesture.dx) > 14
        && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4 && (!current.current.rightOnly || gesture.dx > 0);
    },
    onPanResponderGrant: () => {current.current.translation.stopAnimation(); current.current.onStart();},
    onPanResponderMove: (_event, gesture) => current.current.translation.setValue(gesture.dx),
    onPanResponderRelease: (_event, gesture) => current.current.onRelease(gesture.dx, gesture.vx * 1000, false),
    onPanResponderTerminate: (_event, gesture) => current.current.onRelease(gesture.dx, 0, true),
    onPanResponderTerminationRequest: () => true,
  }), []);
  return <View testID={props.testID} {...responder.panHandlers}
    style={[{flex: 1, minHeight: 0}, Platform.OS === 'web' && ({touchAction: 'pan-y'} as ViewStyle)]}>{props.children}</View>;
}
