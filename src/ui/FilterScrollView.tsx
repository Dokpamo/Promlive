import {forwardRef} from 'react';
import {ScrollView, type ScrollViewProps} from 'react-native';
import type {GestureBlockRef} from './HorizontalGesture.types';

export type FilterScrollViewProps = ScrollViewProps & {blockerRef?: GestureBlockRef};

/** Horizontal filters own their pointer drag instead of triggering page back. */
export const FilterScrollView = forwardRef<ScrollView, FilterScrollViewProps>(({blockerRef, ...props}, ref) =>
  <ScrollView {...props} ref={ref} {...(blockerRef ? {dataSet: {horizontalScroll: 'true'}} : {})}/>);
