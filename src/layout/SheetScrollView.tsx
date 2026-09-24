import {useMemo, useRef, type Ref, type RefObject} from 'react';
import {PanResponder, ScrollView, type ScrollViewProps} from 'react-native';
import type {SheetScrollState} from './sheetMotion';
import {useSheetDrag, type SheetDrag} from './SwipeBackModal';

export type SheetScrollViewProps = ScrollViewProps & {ref?: Ref<ScrollView>; sheetScroll: RefObject<SheetScrollState>; sheetDrag?: SheetDrag; horizontalDrag?: SheetDrag; canStartInputScroll?: () => boolean};

export function SheetScrollView({sheetScroll, sheetDrag: _sheetDrag, horizontalDrag, canStartInputScroll: _canStartInputScroll, ...props}: SheetScrollViewProps) {
  const modalDrag = useSheetDrag();
  const latest = useRef({horizontalDrag, modalDrag, enabled: props.scrollEnabled !== false});
  latest.current = {horizontalDrag, modalDrag, enabled: props.scrollEnabled !== false};
  const pan = useMemo(() => {
    let vertical = false, owned = false;
    let captured = {dx: 0, dy: 0};
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {vertical = false; owned = false; return false;},
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        const {horizontalDrag: drag, modalDrag: modal, enabled} = latest.current;
        if (vertical || !enabled || !drag?.canStart() || modal?.canStart() === false || gesture.numberActiveTouches !== 1) return false;
        if (Math.abs(gesture.dy) > 10 && Math.abs(gesture.dy) >= Math.abs(gesture.dx)) vertical = true;
        if (vertical || Math.abs(gesture.dx) <= 10 || Math.abs(gesture.dx) <= Math.abs(gesture.dy) * 1.25) return false;
        captured = gesture;
        return true;
      },
      onPanResponderGrant: () => {owned = true; latest.current.horizontalDrag?.begin(captured.dx, captured.dy);},
      onPanResponderMove: (_, gesture) => {if (owned) latest.current.horizontalDrag?.move(gesture.dx, gesture.dy);},
      onPanResponderRelease: (_, gesture) => {if (owned) latest.current.horizontalDrag?.release(gesture.dx, gesture.dy, gesture.vx, gesture.vy, gesture.numberActiveTouches > 1); owned = false;},
      onPanResponderTerminate: () => {if (owned) latest.current.horizontalDrag?.release(0, 0, 0, 0, true); owned = false;},
      onPanResponderTerminationRequest: () => !owned,
    });
  }, []);
  sheetScroll.current.nativeGesture = false;
  return <ScrollView {...props} {...(horizontalDrag ? pan.panHandlers : {})}/>;
}
