import {useMemo, useRef, useState, type KeyboardEvent} from 'react';
import {PanResponder, Platform, View} from 'react-native';
import {maximumPhotoZoom} from '../../features/profile/photoCrop';
import {usePalette} from '../Theme';

const thumb = 20, touchHeight = 48;

export function PhotoZoomSlider({value, onChange, disabled}: {value: number; onChange: (value: number) => void; disabled: boolean}) {
  const colors = usePalette();
  const [width, setWidth] = useState(0);
  const latest = useRef({value, onChange, disabled});
  latest.current = {value, onChange, disabled};
  const drag = useRef<number | null>(null);
  const track = Math.max(0, width - thumb);
  const progress = (value - 1) / (maximumPhotoZoom - 1);
  const change = (next: number) => {
    if (!latest.current.disabled) latest.current.onChange(Math.max(1, Math.min(maximumPhotoZoom, next)));
  };
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !latest.current.disabled,
    onMoveShouldSetPanResponder: () => !latest.current.disabled,
    onPanResponderGrant: event => {
      if (latest.current.disabled || !track) return;
      const center = thumb / 2 + (latest.current.value - 1) / (maximumPhotoZoom - 1) * track;
      const x = event.nativeEvent.locationX;
      // Preserve the value when the user grabs the thumb off-center.
      drag.current = Math.max(0, Math.min(track, (Math.abs(x - center) <= touchHeight / 2 ? center : x) - thumb / 2));
      change(1 + drag.current / track * (maximumPhotoZoom - 1));
    },
    onPanResponderMove: (_event, gesture) => {
      // Accumulated travel stays stable when Android's locationX origin changes.
      if (drag.current !== null && track) change(1 + (drag.current + gesture.dx) / track * (maximumPhotoZoom - 1));
    },
    onPanResponderRelease: () => {drag.current = null;},
    onPanResponderTerminate: () => {drag.current = null;},
    onPanResponderTerminationRequest: () => false,
  }), [track]);
  return <View testID="ui-profile-photo-zoom" accessible accessibilityRole="adjustable" accessibilityLabel="사진 확대 비율"
    accessibilityValue={{min: 100, max: maximumPhotoZoom * 100, now: Math.round(value * 100), text: `${Math.round(value * 100)}%`}}
    accessibilityState={{disabled}} accessibilityActions={[{name: 'increment'}, {name: 'decrement'}]}
    onAccessibilityAction={event => {
      if (event.nativeEvent.actionName === 'increment') change(latest.current.value + .1);
      if (event.nativeEvent.actionName === 'decrement') change(latest.current.value - .1);
    }}
    {...(Platform.OS === 'web' ? {tabIndex: disabled ? -1 : 0, onKeyDown: (event: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        change(event.key === 'Home' ? 1 : event.key === 'End' ? maximumPhotoZoom : latest.current.value + (['ArrowRight', 'ArrowUp'].includes(event.key) ? .1 : -.1));
      }
    }} : {})}
    onLayout={event => setWidth(event.nativeEvent.layout.width)}
    style={{flex: 1, height: touchHeight, justifyContent: 'center', opacity: disabled ? .4 : 1}}
    {...pan.panHandlers}>
    <View pointerEvents="none" style={{position: 'absolute', left: thumb / 2, right: thumb / 2, height: 3, borderRadius: 2, backgroundColor: colors.border}}/>
    <View pointerEvents="none" style={{position: 'absolute', left: thumb / 2, width: progress * track, height: 3, borderRadius: 2, backgroundColor: colors.foreground}}/>
    <View pointerEvents="none" style={{position: 'absolute', left: progress * track, width: thumb, height: thumb, borderRadius: thumb / 2, backgroundColor: colors.foreground}}/>
  </View>;
}
