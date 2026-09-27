import {pickProfileImage} from './pickProfileImage';

export async function importCardImage() {
  const photo = await pickProfileImage();
  if (!photo) return null;
  const image = new Image(); image.src = photo.uri; await image.decode();
  const scale = Math.min(1, 1024 / Math.max(photo.width, photo.height));
  const width = Math.max(1, Math.round(photo.width * scale)), height = Math.max(1, Math.round(photo.height * scale));
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('이미지를 불러오지 못했어요.');
  context.drawImage(image, 0, 0, width, height);
  return {uri: canvas.toDataURL('image/jpeg', 0.9), width, height};
}
