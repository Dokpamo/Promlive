import {z} from 'zod';
import {cardSchema, type Card} from '../cards/model';
import {assetReferences} from '../cards/experience';
import {assetSchema} from './assets';
import type {AuthoringStore} from './store';

function utf8Size(value: string) {let size = 0; for (const char of value) {const point = char.codePointAt(0)!; size += point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4;} return size;}
export const bundleMaxBytes = 32 * 1024 * 1024;
const portableCard = cardSchema.pick({title: true, creator: true, description: true, genre: true, tags: true, pocket: true, cover: true, coverAssetId: true, body: true, experience: true}).strict().refine(card => card.body.kind === 'template', '이 버전에서는 프롬프트 카드 파일을 가져올 수 있어요.');
export const bundleSchema = z.object({format: z.literal('promlive-card'), version: z.literal(1), card: portableCard, assets: z.array(assetSchema).max(300)}).strict().superRefine((bundle, ctx) => {
  const ids = new Set(bundle.assets.map(a => a.id));
  if (ids.size !== bundle.assets.length) ctx.addIssue({code: 'custom', message: '중복된 에셋이 있어요.'});
  const referenced = [bundle.card.coverAssetId, ...(bundle.card.experience?.resources.flatMap(r => r.assetIds) ?? [])].filter(Boolean);
  if (referenced.some(id => !ids.has(id!))) ctx.addIssue({code: 'custom', message: '파일에 연결된 에셋이 빠져 있어요.'});
  if (bundle.card.coverAssetId && !bundle.assets.find(a => a.id === bundle.card.coverAssetId)?.uri.startsWith('data:image/')) ctx.addIssue({code: 'custom', message: '카드 표지는 이미지여야 해요.'});
});
export function parseCardBundle(text: string) {
  if (text.length > bundleMaxBytes || utf8Size(text) > bundleMaxBytes) throw new Error('카드 파일은 32MB까지 가져올 수 있어요.');
  try {return bundleSchema.parse(JSON.parse(text));}
  catch {throw new Error('지원하는 Promlive 카드 파일(.promcard)이 아니거나 구성·에셋이 올바르지 않아요.');}
}
export async function exportCardBundle(card: Card, store: Pick<AuthoringStore, 'getAsset'>) {
  if (card.studioDraft) throw new Error('먼저 카드를 완성해 주세요.');
  const assets = await Promise.all(assetReferences(card).map(async id => {
    const asset = await store.getAsset(id);
    if (!asset) throw new Error('연결된 에셋을 찾을 수 없어 내보내지 못했어요.');
    return asset;
  }));
  // Only public card content is shared; creation chats, credentials and rooms stay local.
  const contents = JSON.stringify(bundleSchema.parse({format: 'promlive-card', version: 1, card: portableCard.parse({title: card.title, description: card.description, genre: card.genre, cover: card.cover, body: card.body,
    ...(card.creator ? {creator: card.creator} : {}), ...(card.coverAssetId ? {coverAssetId: card.coverAssetId} : {}), ...(card.experience ? {experience: card.experience} : {}), ...(card.tags ? {tags: card.tags} : {}), ...(card.pocket ? {pocket: card.pocket} : {})}), assets}));
  if (utf8Size(contents) > bundleMaxBytes) throw new Error('카드 파일이 32MB를 넘어요. 에셋 크기를 줄여 주세요.');
  const filename = `${card.title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 80) || 'Promlive'}.promcard`;
  return {contents, filename};
}
