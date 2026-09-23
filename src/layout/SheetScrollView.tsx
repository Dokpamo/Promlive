import type {Ref, RefObject} from 'react';
import {ScrollView, type ScrollViewProps} from 'react-native';
import type {SheetScrollState} from './sheetMotion';

export type SheetScrollViewProps = ScrollViewProps & {ref?: Ref<ScrollView>; sheetScroll: RefObject<SheetScrollState>};

export function SheetScrollView({sheetScroll, ...props}: SheetScrollViewProps) {
  sheetScroll.current.nativeGesture = false;
  return <ScrollView {...props}/>;
}
