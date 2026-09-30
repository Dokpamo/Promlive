import {Image} from 'react-native';
import {libraryPreviewAtlas} from './images/libraryPreview';

/** Centre-crop a square atlas tile into a portrait cover or a circular avatar frame. */
export function PreviewArtwork({tile, width, height}: {tile: number; width: number; height: number}) {
  const cell = Math.max(width, height);
  return <Image accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    source={libraryPreviewAtlas} fadeDuration={0} resizeMode="stretch"
    style={{position: 'absolute', width: cell * 3, height: cell * 4,
      left: -(tile % 3) * cell - (cell - width) / 2,
      top: -Math.floor(tile / 3) * cell - (cell - height) / 2}}/>;
}
