import {pickProfileImage} from './pickProfileImage';

export async function importCardImage() {
  const photo = await pickProfileImage();
  if (!photo) return null;
  const {default: ImageEditor} = await import('@react-native-community/image-editor');
  const scale = Math.min(1, 1024 / Math.max(photo.width, photo.height));
  const width = Math.max(1, Math.round(photo.width * scale)), height = Math.max(1, Math.round(photo.height * scale));
  const result = await ImageEditor.cropImage(photo.uri, {offset: {x: 0, y: 0}, size: {width: photo.width, height: photo.height}, displaySize: {width, height}, format: 'jpeg', quality: 0.9, includeBase64: true});
  if (!result.base64 || !result.type) throw new Error('사진을 저장할 수 없어요. 다른 사진을 선택해 주세요.');
  return {uri: `data:${result.type};base64,${result.base64}`, width, height};
}
