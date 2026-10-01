import {useCallback, useLayoutEffect, useMemo, useRef} from 'react';
import {Animated} from 'react-native';
import {previewArtworkRatio} from './PreviewArtwork';
import {clampImage, fitImage, imageAtRest, zoomImageAt, type ImagePosition} from './imageViewport';
import type {ImageSurfaceProps} from './ImageSurface.types';

/** Keep the image and its atlas crop on one stable transform throughout gestures. */
export function useImageTransform({tile, width, height, onZoomChange}: ImageSurfaceProps) {
  const image = useMemo(() => fitImage(width, height, previewArtworkRatio(tile)), [tile, width, height]);
  const position = useRef(imageAtRest);
  const scale = useRef(new Animated.Value(1)).current;
  const x = useRef(new Animated.Value(0)).current, y = useRef(new Animated.Value(0)).current;
  const commit = useCallback((next: ImagePosition) => {
    const value = clampImage(next, image, {width, height});
    position.current = value;
    scale.setValue(value.scale); x.setValue(value.x); y.setValue(value.y);
    onZoomChange(value.scale > 1.01);
  }, [image, width, height, scale, x, y, onZoomChange]);
  useLayoutEffect(() => {commit(imageAtRest);}, [tile, commit]);
  const toggleZoom = useCallback((atX = width / 2, atY = height / 2) => {
    const before = position.current;
    commit(before.scale > 1.01 ? imageAtRest : zoomImageAt(before, 2.5, atX - width / 2, atY - height / 2));
  }, [commit, width, height]);
  return {image, position, scale, x, y, commit, toggleZoom};
}
