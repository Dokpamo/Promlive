import {Platform} from 'react-native';
import {avatarImageSchema} from '../../features/profile/userProfile';

/** Copy a small image into local preferences instead of keeping a temporary gallery URI. */
export async function pickProfileImage(): Promise<string | null> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') throw new Error('이 기기에서는 아직 사진 선택을 지원하지 않아요.');
  const {launchImageLibrary} = await import('react-native-image-picker');
  const result = await launchImageLibrary({mediaType: 'photo', selectionLimit: 1, maxWidth: 512, maxHeight: 512, quality: 0.8, includeBase64: true, includeExtra: false, assetRepresentationMode: 'compatible'});
  if (result.didCancel) return null;
  if (result.errorCode) throw new Error(result.errorCode === 'permission' ? '사진을 선택하려면 사진 접근을 허용해 주세요.' : '사진을 열지 못했어요. 다시 선택해 주세요.');
  const asset = result.assets?.[0];
  if (!asset?.base64 || !asset.width || !asset.height || asset.width > 512 || asset.height > 512) throw new Error('이 사진을 불러오지 못했어요. 다른 사진을 선택해 주세요.');
  const mime = asset.type === 'image/jpg' ? 'image/jpeg' : asset.type;
  const image = avatarImageSchema.safeParse(`data:${mime};base64,${asset.base64}`);
  if (!image.success) throw new Error('JPG, PNG, WebP 사진을 선택해 주세요.');
  return image.data;
}
