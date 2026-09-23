import {Platform} from 'react-native';
import type {ProfilePhoto} from '../../features/profile/photoCrop';

/** Keep the full photo until the user confirms a crop; temporary URIs are never persisted. */
export async function pickProfileImage(): Promise<ProfilePhoto | null> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') throw new Error('이 기기에서는 아직 사진 선택을 지원하지 않아요.');
  const {launchImageLibrary} = await import('react-native-image-picker');
  const result = await launchImageLibrary({mediaType: 'photo', selectionLimit: 1, maxWidth: 2048, maxHeight: 2048, quality: 0.9, includeExtra: false, assetRepresentationMode: 'compatible'});
  if (result.didCancel) return null;
  if (result.errorCode) throw new Error(result.errorCode === 'permission' ? '사진을 선택하려면 사진 접근을 허용해 주세요.' : '사진을 열지 못했어요. 다시 선택해 주세요.');
  const asset = result.assets?.[0];
  if (!asset?.uri || !asset.width || !asset.height) throw new Error('이 사진을 불러오지 못했어요. 다른 사진을 선택해 주세요.');
  return {uri: asset.uri, width: asset.width, height: asset.height};
}
