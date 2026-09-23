export interface ProfilePhoto {uri: string; width: number; height: number}
export interface PhotoCrop {zoom: number; x: number; y: number}
export interface CropRect {x: number; y: number; size: number}
export interface CropTouch {x: number; y: number; distance: number; count: number}
export const initialPhotoCrop: PhotoCrop = {zoom: 1, x: 0, y: 0};
export const maximumPhotoZoom = 4;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** The image always covers the fixed circle, including after zooming back out. */
export function constrainPhotoCrop(photo: ProfilePhoto, diameter: number, crop: PhotoCrop): PhotoCrop {
  const zoom = clamp(crop.zoom, 1, maximumPhotoZoom);
  const scale = diameter / Math.min(photo.width, photo.height) * zoom;
  const limitX = Math.max(0, (photo.width * scale - diameter) / 2);
  const limitY = Math.max(0, (photo.height * scale - diameter) / 2);
  return {zoom, x: clamp(crop.x, -limitX, limitX), y: clamp(crop.y, -limitY, limitY)};
}

/** Keep the image point between the fingers under their moving midpoint. */
export function movePhotoCrop(photo: ProfilePhoto, diameter: number, crop: PhotoCrop, from: CropTouch, to: CropTouch): PhotoCrop {
  const zoom = clamp(crop.zoom * (from.count > 1 && from.distance > 0 ? to.distance / from.distance : 1), 1, maximumPhotoZoom);
  const ratio = zoom / crop.zoom;
  return constrainPhotoCrop(photo, diameter, {zoom, x: to.x - (from.x - crop.x) * ratio, y: to.y - (from.y - crop.y) * ratio});
}

export function zoomPhotoCrop(photo: ProfilePhoto, diameter: number, crop: PhotoCrop, zoom: number): PhotoCrop {
  const next = clamp(zoom, 1, maximumPhotoZoom);
  return constrainPhotoCrop(photo, diameter, {zoom: next, x: crop.x * next / crop.zoom, y: crop.y * next / crop.zoom});
}

/** Convert the on-screen circle's bounding square to source-image pixels. */
export function photoCropRect(photo: ProfilePhoto, diameter: number, crop: PhotoCrop): CropRect {
  const bounded = constrainPhotoCrop(photo, diameter, crop);
  const scale = diameter / Math.min(photo.width, photo.height) * bounded.zoom;
  const size = Math.max(1, Math.round(Math.min(photo.width, photo.height) / bounded.zoom));
  return {
    x: clamp(Math.round((photo.width - size) / 2 - bounded.x / scale), 0, photo.width - size),
    y: clamp(Math.round((photo.height - size) / 2 - bounded.y / scale), 0, photo.height - size),
    size,
  };
}
