import {Image} from 'react-native';
import {libraryPreviewAtlas} from './images/libraryPreview';
import {nightLibraryCover} from './images/nightLibraryCover';
import {galleryArtwork} from './images/galleryArtwork';

/** Detail views use the complete original image, including square atlas tiles. */
export function previewArtworkRatio(tile: number) {
  const gallery = galleryArtwork[tile - 12];
  if (gallery) return gallery.width / gallery.height;
  return tile === 0 ? nightLibraryCover.width / nightLibraryCover.height : 1;
}

/** Share the same bundled artwork between covers and avatar frames. */
export function PreviewArtwork({tile, width, height, fullImage = false}: {tile: number; width: number; height: number; fullImage?: boolean}) {
  const gallery = galleryArtwork[tile - 12];
  if (gallery) return <Image accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    source={gallery} fadeDuration={0} resizeMode={fullImage ? 'contain' : 'cover'} style={{width, height}}/>;
  if (tile === 0) return <Image accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    source={nightLibraryCover} fadeDuration={0} resizeMode={fullImage ? 'contain' : 'cover'} style={{width, height}}/>;
  const cell = Math.max(width, height);
  return <Image accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    source={libraryPreviewAtlas} fadeDuration={0} resizeMode="stretch"
    style={{position: 'absolute', width: cell * 3, height: cell * 4,
      left: -(tile % 3) * cell - (cell - width) / 2,
      top: -Math.floor(tile / 3) * cell - (cell - height) / 2}}/>;
}
