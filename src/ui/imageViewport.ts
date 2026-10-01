export type ImagePosition = {scale: number; x: number; y: number};
export const imageAtRest: ImagePosition = {scale: 1, x: 0, y: 0};
export function fitImage(width: number, height: number, ratio: number) {
  const imageWidth = Math.min(width, height * ratio);
  return {width: imageWidth, height: imageWidth / ratio};
}
export function clampImage(position: ImagePosition, image: {width: number; height: number}, viewport: {width: number; height: number}): ImagePosition {
  const scale = Math.max(1, Math.min(4, position.scale));
  const limitX = Math.max(0, (image.width * scale - viewport.width) / 2);
  const limitY = Math.max(0, (image.height * scale - viewport.height) / 2);
  return {scale, x: Math.max(-limitX, Math.min(limitX, position.x)), y: Math.max(-limitY, Math.min(limitY, position.y))};
}
export function zoomImageAt(position: ImagePosition, scale: number, x: number, y: number): ImagePosition {
  const ratio = scale / position.scale;
  return {scale, x: x - (x - position.x) * ratio, y: y - (y - position.y) * ratio};
}
