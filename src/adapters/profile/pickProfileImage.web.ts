import type {ProfilePhoto} from '../../features/profile/photoCrop';

export function pickProfileImage(): Promise<ProfilePhoto | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
    const finish = (image: ProfilePhoto | null, error?: unknown) => {
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

/** Normalize orientation and bound the preview without discarding any part of the photo. */
export async function profileImageFromFile(file: File): Promise<ProfilePhoto> {
  if (!file.type.startsWith('image/') || file.size > 25 * 1024 * 1024) throw new Error('Unsupported photo');
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height) throw new Error('Empty photo');
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image conversion unavailable');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return {uri: canvas.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.95), width: canvas.width, height: canvas.height};
  } finally {bitmap.close();}
}
