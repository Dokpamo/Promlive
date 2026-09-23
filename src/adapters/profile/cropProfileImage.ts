import type {CropRect, ProfilePhoto} from '../../features/profile/photoCrop';
import {avatarImageSchema} from '../../features/profile/userProfile';

/** Persist the rendered crop, not a gallery URI or a transient editor transform. */
export async function cropProfileImage(photo: ProfilePhoto, crop: CropRect): Promise<string> {
  const {default: ImageEditor} = await import('@react-native-community/image-editor');
  const size = Math.min(512, crop.size);
  const result = await ImageEditor.cropImage(photo.uri, {
    offset: {x: crop.x, y: crop.y}, size: {width: crop.size, height: crop.size},
    displaySize: {width: size, height: size}, format: 'png', includeBase64: true,
  });
  return avatarImageSchema.parse(`data:${result.type};base64,${result.base64}`);
}
