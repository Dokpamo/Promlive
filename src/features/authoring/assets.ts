import {z} from 'zod';

export const assetSchema = z.object({
  id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  uri: z.string().max(16000000).regex(/^data:(image\/(png|jpeg|webp)|audio\/(mpeg|mp4|wav|x-wav|ogg)|application\/(octet-stream|json|pdf)|text\/plain);base64,[A-Za-z0-9+/=\r\n]+$/),
  width: z.number().int().min(0).max(2048), height: z.number().int().min(0).max(2048),
  name: z.string().max(180).optional(),
}).strict();
export type CardAsset = z.infer<typeof assetSchema>;
export const isImageAsset = (asset: CardAsset) => asset.uri.startsWith('data:image/');
