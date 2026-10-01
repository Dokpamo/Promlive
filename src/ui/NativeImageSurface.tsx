import {forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Animated, StyleSheet, View} from 'react-native';
import {PanGestureHandler, PinchGestureHandler, State, TapGestureHandler,
  type PanGestureHandlerStateChangeEvent, type PinchGestureHandlerStateChangeEvent} from 'react-native-gesture-handler';
import {PreviewArtwork} from './PreviewArtwork';
import {useImageTransform} from './useImageTransform';
import type {ImageSurfaceHandle, ImageSurfaceProps} from './ImageSurface.types';

/** Native events drive scale and drag directly; JS only commits gesture endpoints. */
export const ImageSurface = forwardRef<ImageSurfaceHandle, ImageSurfaceProps>((props, ref) => {
  const image = useImageTransform(props);
  const [zoomed, setZoomed] = useState(false);
  const [pinching, setPinching] = useState(false);
  const pinch = useRef(new Animated.Value(1)).current;
  const panX = useRef(new Animated.Value(0)).current, panY = useRef(new Animated.Value(0)).current;
  useLayoutEffect(() => {setZoomed(false); setPinching(false); pinch.setValue(1); panX.setValue(0); panY.setValue(0);}, [props.tile, props.width, props.height, pinch, panX, panY]);
  const scale = useMemo(() => Animated.multiply(image.scale, pinch).interpolate({inputRange: [1, 4], outputRange: [1, 4], extrapolate: 'clamp'}), [image.scale, pinch]);
  const x = useMemo(() => Animated.add(image.x, panX), [image.x, panX]);
  const y = useMemo(() => Animated.add(image.y, panY), [image.y, panY]);
  const pinchEvent = useMemo(() => Animated.event([{nativeEvent: {scale: pinch}}], {useNativeDriver: true}), [pinch]);
  const panEvent = useMemo(() => Animated.event([{nativeEvent: {translationX: panX, translationY: panY}}], {useNativeDriver: true}), [panX, panY]);
  function toggle(atX?: number, atY?: number) {
    image.toggleZoom(atX, atY); setZoomed(image.position.current.scale > 1.01);
  }
  useImperativeHandle(ref, () => ({toggleZoom: () => toggle()}));
  function pinchChanged({nativeEvent: event}: PinchGestureHandlerStateChangeEvent) {
    if (event.state === State.ACTIVE) {setPinching(true); props.onZoomChange(true);}
    if (event.oldState === State.ACTIVE && event.state !== State.ACTIVE) {
      image.commit({...image.position.current, scale: image.position.current.scale * event.scale});
      pinch.setValue(1); setPinching(false); setZoomed(image.position.current.scale > 1.01);
    }
  }
  function panChanged({nativeEvent: event}: PanGestureHandlerStateChangeEvent) {
    if (event.oldState === State.ACTIVE && event.state !== State.ACTIVE) {
      const before = image.position.current;
      image.commit({...before, x: before.x + event.translationX, y: before.y + event.translationY});
      panX.setValue(0); panY.setValue(0);
    }
  }
  return <PinchGestureHandler onGestureEvent={pinchEvent} onHandlerStateChange={pinchChanged}>
    <Animated.View testID="ui-image-surface" style={styles.viewport}>
      <PanGestureHandler enabled={zoomed && !pinching} minDist={2} maxPointers={1} onGestureEvent={panEvent} onHandlerStateChange={panChanged}>
        <Animated.View style={styles.viewport}>
          <TapGestureHandler numberOfTaps={2} maxDelayMs={240} onHandlerStateChange={({nativeEvent: event}) => {
            if (event.state === State.END) toggle(event.x, event.y);
          }}>
            <Animated.View style={styles.viewport}>
              <Animated.View testID="ui-image-transform" style={{transform: [{translateX: x}, {translateY: y}, {scale}]}}>
                <View testID="ui-image-artwork" accessible accessibilityRole="image" accessibilityLabel={props.label}
                  style={{...image.image, overflow: 'hidden'}}>
                  <PreviewArtwork tile={props.tile} {...image.image} fullImage/>
                </View>
              </Animated.View>
            </Animated.View>
          </TapGestureHandler>
        </Animated.View>
      </PanGestureHandler>
    </Animated.View>
  </PinchGestureHandler>;
});
const styles = StyleSheet.create({viewport: {flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'}});
