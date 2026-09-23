import {useImperativeHandle, useMemo, useRef} from 'react';
import {ScrollView} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import type {SheetScrollViewProps} from './SheetScrollView';
import {createSheetScrollHandoff} from './sheetScrollHandoff';
import {useSheetDrag} from './SwipeBackModal';

/** Observe native scrolling, then give the sheet the first elastic pull and later dismissal. */
export function SheetScrollView({sheetScroll, ref, ...props}: SheetScrollViewProps) {
  const scrollView = useRef<ScrollView>(null);
  useImperativeHandle(ref, () => scrollView.current!, []);
  const drag = useSheetDrag();
  const latest = useRef({drag, sheetScroll, enabled: props.scrollEnabled !== false});
  latest.current = {drag, sheetScroll, enabled: props.scrollEnabled !== false};
  sheetScroll.current.nativeGesture = true;

  const gestures = useMemo(() => {
    const handoff = createSheetScrollHandoff();
    let claim: {x: number; y: number; dx: number; dy: number} | undefined;
    let owned = false;
    let cancelled = false;
    const native = Gesture.Native().shouldCancelWhenOutside(false);
    const pan = Gesture.Pan().minDistance(10).runOnJS(true).maxPointers(1)
      .shouldCancelWhenOutside(false).simultaneousWithExternalGesture(native)
      .onBegin(event => {
        handoff.reset(event.absoluteX, event.absoluteY, latest.current.sheetScroll.current);
        claim = undefined;
        cancelled = false;
      })
      .onUpdate(event => {
        if (event.numberOfPointers !== 1) cancelled = true;
        if (cancelled || !latest.current.drag?.canStart()) return;
        if (!claim) {
          const movement = handoff.move(event.absoluteX, event.absoluteY, latest.current.sheetScroll.current);
          if (!movement) return;
          claim = {x: event.absoluteX, y: event.absoluteY, dx: movement.x, dy: movement.y};
          owned = true;
          scrollView.current?.setNativeProps({scrollEnabled: false});
          latest.current.drag.begin(claim.dx, claim.dy, movement.returnOnly);
        } else latest.current.drag.move(event.absoluteX - claim.x, event.absoluteY - claim.y);
      })
      .onFinalize((event, success) => {
        if (!owned || !claim) return;
        owned = false;
        // Restore first: a dismissal may immediately disable this outgoing
        // scroller again so the next gesture can belong to the underlying page.
        scrollView.current?.setNativeProps({scrollEnabled: latest.current.enabled});
        latest.current.drag?.release(event.absoluteX - claim.x, event.absoluteY - claim.y, event.velocityX / 1000, event.velocityY / 1000, !success || cancelled);
        claim = undefined;
      });
    return {pan, native};
  }, []);

  // The sheet supplies edge resistance; do not stretch its contents a second time.
  return <GestureDetector gesture={gestures.pan}>
    <GestureDetector gesture={gestures.native}>
      <ScrollView {...props} ref={scrollView} bounces={false} overScrollMode="never"/>
    </GestureDetector>
  </GestureDetector>;
}
