import type {CropRect, ProfilePhoto} from '../../features/profile/photoCrop';
import {avatarImageSchema} from '../../features/profile/userProfile';

export async function cropProfileImage(photo: ProfilePhoto, crop: CropRect): Promise<string> {
  const image = new Image();
  image.src = photo.uri;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(512, crop.size);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image conversion unavailable');
  context.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, canvas.width, canvas.height);
  return avatarImageSchema.parse(canvas.toDataURL('image/png'));
}
