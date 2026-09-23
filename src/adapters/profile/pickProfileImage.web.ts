import {avatarImageSchema} from '../../features/profile/userProfile';

export function pickProfileImage(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
    const finish = (image: string | null, error?: unknown) => {
      input.remove();
      if (error) reject(new Error('사진을 열지 못했어요. JPG, PNG, WebP 사진으로 다시 선택해 주세요.'));
      else resolve(image);
    };
    input.oncancel = () => finish(null);
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {finish(null); return;}
      try {finish(await profileImageFromFile(file));} catch (error) {finish(null, error);}
    };
    document.body.append(input); input.click();
  });
}

/** Strip the source metadata and limit the stored image to a 512px square crop. */
export async function profileImageFromFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.size > 25 * 1024 * 1024) throw new Error('Unsupported photo');
  const bitmap = await createImageBitmap(file);
  try {
    const crop = Math.min(bitmap.width, bitmap.height);
    if (!crop) throw new Error('Empty photo');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(512, crop);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image conversion unavailable');
    context.drawImage(bitmap, (bitmap.width - crop) / 2, (bitmap.height - crop) / 2, crop, crop, 0, 0, canvas.width, canvas.height);
    return avatarImageSchema.parse(canvas.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.8));
  } finally {bitmap.close();}
}
