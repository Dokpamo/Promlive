import type {Ref, RefObject} from 'react';
import {ScrollView, type ScrollViewProps} from 'react-native';
import type {SheetScrollState} from './sheetMotion';
import type {SheetDrag} from './SwipeBackModal';

export type SheetScrollViewProps = ScrollViewProps & {ref?: Ref<ScrollView>; sheetScroll: RefObject<SheetScrollState>; sheetDrag?: SheetDrag; canStartInputScroll?: () => boolean};

export function SheetScrollView({sheetScroll, sheetDrag: _sheetDrag, canStartInputScroll: _canStartInputScroll, ...props}: SheetScrollViewProps) {
  sheetScroll.current.nativeGesture = false;
  return <ScrollView {...props}/>;
}
