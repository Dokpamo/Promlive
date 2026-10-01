import {forwardRef} from 'react';
import {ScrollView} from 'react-native';
import {NativeViewGestureHandler} from 'react-native-gesture-handler';
import type {FilterScrollViewProps} from './FilterScrollView';

export const FilterScrollView = forwardRef<ScrollView, FilterScrollViewProps>(({blockerRef, ...props}, ref) => {
  const content = <ScrollView {...props} ref={ref}/>;
  // Wait for an actual scroll so a stationary touch can still long-press a chip.
  return blockerRef ? <NativeViewGestureHandler ref={blockerRef} disallowInterruption shouldCancelWhenOutside={false}>
    {content}
  </NativeViewGestureHandler> : content;
});
