import {useImperativeHandle, useMemo, useRef, useState} from 'react';
import {ScrollView} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import type {SheetScrollViewProps} from './SheetScrollView';
import {createSheetScrollHandoff} from './sheetScrollHandoff';
import {useSheetDrag} from './SwipeBackModal';
import type {SheetDrag} from './SwipeBackModal';
import {SheetInputGesture} from './SheetTextInput.touch';

/** Observe native scrolling, then give the sheet the first elastic pull and later dismissal. */
export function SheetScrollView({sheetScroll, sheetDrag, horizontalDrag, canStartInputScroll, ref, ...props}: SheetScrollViewProps) {
  const scrollView = useRef<ScrollView>(null);
  useImperativeHandle(ref, () => scrollView.current!, []);
  const modalDrag = useSheetDrag();
  const drag = sheetDrag ?? modalDrag;
  const [inputEnabled, setInputEnabled] = useState(true);
  const latest = useRef({drag, horizontalDrag, sheetScroll, canStartInputScroll, enabled: props.scrollEnabled !== false});
  latest.current = {drag, horizontalDrag, sheetScroll, canStartInputScroll, enabled: props.scrollEnabled !== false};
  sheetScroll.current.nativeGesture = true;

  const gestures = useMemo(() => {
    const handoff = createSheetScrollHandoff();
    let claim: {x: number; y: number; dx: number; dy: number} | undefined;
    let owned = false;
    let cancelled = false;
    let axis: 'horizontal' | 'vertical' | undefined;
    let owner: SheetDrag | undefined;
    let origin = {x: 0, y: 0};
    const native = Gesture.Native().shouldCancelWhenOutside(false);
    let inputOrigin = {x: 0, y: 0};
    const input = Gesture.Native().runOnJS(true).simultaneousWithExternalGesture(native)
      .onTouchesDown(event => {
        const touch = event.allTouches[0];
        if (touch) inputOrigin = {x: touch.absoluteX, y: touch.absoluteY};
      })
      .onTouchesMove(event => {
        const touch = event.allTouches[0];
        if (!touch || event.numberOfTouches !== 1 || !latest.current.enabled || !latest.current.sheetScroll.current.canScroll || latest.current.canStartInputScroll?.() === false) return;
        // A scroll cancels TextInput's pending long press, while existing text
        // selection keeps its native handles and editing gestures.
        if (Math.hypot(touch.absoluteX - inputOrigin.x, touch.absoluteY - inputOrigin.y) > 10) setInputEnabled(false);
      });
    native.simultaneousWithExternalGesture(input);
    const pan = Gesture.Pan().minDistance(10).runOnJS(true).maxPointers(1)
      .shouldCancelWhenOutside(false).simultaneousWithExternalGesture(native, input)
      .onBegin(event => {
        handoff.reset(event.absoluteX, event.absoluteY, latest.current.sheetScroll.current);
        origin = {x: event.absoluteX, y: event.absoluteY};
        axis = undefined; owner = undefined; owned = false;
        claim = undefined;
        cancelled = false;
      })
      .onUpdate(event => {
        if (event.numberOfPointers !== 1) cancelled = true;
        if (cancelled || !latest.current.enabled || !latest.current.drag?.canStart()) return;
        if (!claim) {
          const dx = event.absoluteX - origin.x, dy = event.absoluteY - origin.y;
          if (!axis && Math.hypot(dx, dy) > 10) axis = Math.abs(dx) > Math.abs(dy) * 1.25 && latest.current.horizontalDrag ? 'horizontal' : 'vertical';
          if (axis === 'horizontal' && !latest.current.horizontalDrag?.canStart()) return;
          const movement = axis === 'horizontal' ? {x: dx, y: dy, returnOnly: false} : handoff.move(event.absoluteX, event.absoluteY, latest.current.sheetScroll.current);
          if (!movement) return;
          owner = axis === 'horizontal' ? latest.current.horizontalDrag : latest.current.drag;
          claim = {x: event.absoluteX, y: event.absoluteY, dx: movement.x, dy: movement.y};
          owned = true;
          scrollView.current?.setNativeProps({scrollEnabled: false});
          owner?.begin(claim.dx, claim.dy, movement.returnOnly);
        } else owner?.move(event.absoluteX - claim.x, event.absoluteY - claim.y);
      })
      .onFinalize((event, success) => {
        setInputEnabled(true);
        if (!owned || !claim) return;
        owned = false;
        // Restore first: a dismissal may immediately disable this outgoing
        // scroller again so the next gesture can belong to the underlying page.
        scrollView.current?.setNativeProps({scrollEnabled: latest.current.enabled});
        owner?.release(event.absoluteX - claim.x, event.absoluteY - claim.y, event.velocityX / 1000, event.velocityY / 1000, !success || cancelled);
        claim = undefined;
      });
    return {pan, native, input};
  }, []);

  // The sheet supplies edge resistance; do not stretch its contents a second time.
  const inputBinding = useMemo(() => ({gesture: gestures.input, enabled: inputEnabled}), [gestures, inputEnabled]);
  return <SheetInputGesture.Provider value={inputBinding}><GestureDetector gesture={gestures.pan}>
    <GestureDetector gesture={gestures.native}>
      <ScrollView {...props} ref={scrollView} bounces={false} overScrollMode="never"/>
    </GestureDetector>
  </GestureDetector></SheetInputGesture.Provider>;
}
