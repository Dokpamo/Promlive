import {z} from 'zod';
import type {Card} from './model';
import {activeResources, getExperience, normalizeScene, type SceneState} from './experience';

const fieldSchema = z.object({
  id: z.string().min(1).max(100), label: z.string().min(1).max(60),
  source: z.enum(['location', 'characters', 'flag']), key: z.string().max(60),
}).strict();
export const pocketSchema = z.object({
  version: z.literal(1), title: z.string().min(1).max(120),
  template: z.enum(['tiles', 'list']), fields: z.array(fieldSchema).max(30),
}).strict().refine(value => new Set(value.fields.map(field => field.id)).size === value.fields.length, '중복된 상태 항목이 있어요.');
export type CardPocket = z.infer<typeof pocketSchema>;

export function defaultPocket(card: Card): CardPocket {
  const flags = [...new Set(getExperience(card).starts.flatMap(start => Object.keys(start.flags)))];
  return {version: 1, title: '상태창', template: 'tiles', fields: [
    {id: 'location', label: '현재 장소', source: 'location', key: ''},
    {id: 'characters', label: '등장인물', source: 'characters', key: ''},
    ...flags.slice(0, 28).map((key, index) => ({id: `flag_${index}`, label: key, source: 'flag' as const, key})),
  ]};
}

/** Presentation reads room state; it never becomes part of the AI prompt. */
export function pocketValues(card: Card, pocket: CardPocket, saved?: SceneState | null) {
  const experience = getExperience(card), scene = normalizeScene(experience, saved);
  return pocket.fields.map(field => ({...field, value: field.source === 'location'
    ? experience.resources.find(resource => resource.id === scene.locationId)?.name || '—'
    : field.source === 'characters'
      ? activeResources(experience, scene).filter(resource => resource.kind === 'character').map(resource => resource.name).join(' · ') || '—'
      : scene.flags[field.key] || '—'}));
}
