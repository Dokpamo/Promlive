import {forwardRef, useImperativeHandle, useMemo, useRef} from 'react';
import {Animated, PanResponder, Pressable, View} from 'react-native';
import {PreviewArtwork} from './PreviewArtwork';
import {useImageTransform} from './useImageTransform';
import {zoomImageAt, type ImagePosition} from './imageViewport';
import type {ImageSurfaceHandle, ImageSurfaceProps} from './ImageSurface.types';

/** Desktop/web: drag a magnified image, double-click/tap to zoom, two-finger pinch. */
export const ImageSurface = forwardRef<ImageSurfaceHandle, ImageSurfaceProps>((props, ref) => {
  const image = useImageTransform(props);
  const current = useRef({image, props}); current.current = {image, props};
  const start = useRef<{position: ImagePosition; distance: number; x: number; y: number} | null>(null);
  const lastTap = useRef(0);
  useImperativeHandle(ref, () => ({toggleZoom: () => image.toggleZoom()}));
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.numberActiveTouches > 1 ||
      (current.current.image.position.current.scale > 1.01 && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 3),
    onPanResponderGrant: event => {
      const [a, b] = event.nativeEvent.touches;
      const {image: active, props: viewport} = current.current;
      start.current = {position: {...active.position.current}, distance: a && b ? Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY) : 0,
        x: a && b ? (a.locationX + b.locationX) / 2 - viewport.width / 2 : 0,
        y: a && b ? (a.locationY + b.locationY) / 2 - viewport.height / 2 : 0};
      viewport.onZoomChange(true);
    },
    onPanResponderMove: (event, gesture) => {
      const before = start.current;
      if (!before) return;
      const [a, b] = event.nativeEvent.touches;
      const {image: active} = current.current;
      if (a && b && before.distance) {
        const scale = Math.max(1, Math.min(4, before.position.scale * Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY) / before.distance));
        active.commit(zoomImageAt(before.position, scale, before.x, before.y));
      } else active.commit({...before.position, x: before.position.x + gesture.dx, y: before.position.y + gesture.dy});
    },
    onPanResponderRelease: () => current.current.image.commit(current.current.image.position.current),
    onPanResponderTerminate: () => current.current.image.commit(current.current.image.position.current),
  }), []);
  return <View testID="ui-image-surface" {...responder.panHandlers} style={{flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden'}}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${props.label}. 두 번 눌러 확대`} onPress={event => {
      const now = Date.now();
      if (now - lastTap.current < 260) {image.toggleZoom(event.nativeEvent.locationX, event.nativeEvent.locationY); lastTap.current = 0;}
      else lastTap.current = now;
    }} style={{width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center'}}>
      <Animated.View testID="ui-image-transform" style={{transform: [{translateX: image.x}, {translateY: image.y}, {scale: image.scale}]}}>
        <View testID="ui-image-artwork" accessibilityRole="image" accessibilityLabel={props.label} style={{...image.image, overflow: 'hidden'}}>
          <PreviewArtwork tile={props.tile} {...image.image} fullImage/>
        </View>
      </Animated.View>
    </Pressable>
  </View>;
});
