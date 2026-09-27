import {z} from 'zod';
import type {Card} from './model';

const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const prompt = z.string().max(30000);
export const resourceKinds = ['world', 'place', 'character', 'object', 'lore'] as const;
export const resourceLabels = {world: '세계', place: '장소', character: '인물', object: '오브젝트', lore: '로어'} as const;
export const flagKey = z.string().min(1).max(60).refine(key => !['__proto__', 'prototype', 'constructor'].includes(key));
export const conditionSchema = z.object({key: flagKey, value: z.string().max(300), operator: z.enum(['is', 'isNot'])}).strict();
export const resourceSchema = z.object({
  id, kind: z.enum(resourceKinds), name: z.string().min(1).max(120), prompt,
  assetIds: z.array(id).max(30),
  activation: z.object({enabled: z.boolean(), mode: z.enum(['always', 'conditional', 'manual']), locations: z.array(id).max(100), conditions: z.array(conditionSchema).max(30)}).strict(),
}).strict();
export const startSchema = z.object({
  id, name: z.string().min(1).max(120), prompt, greeting: prompt,
  intro: z.object({kind: z.literal('text'), text: prompt}).strict().optional(),
  locationId: id.nullable(), activeIds: z.array(id).max(100), flags: z.record(flagKey, z.string().max(300)),
}).strict();
export const experienceSchema = z.object({
  version: z.literal(1), resources: z.array(resourceSchema).min(1).max(100),
  starts: z.array(startSchema).min(1).max(30), defaultStartId: id, direction: prompt,
}).strict().superRefine((value, ctx) => {
  const error = (message: string) => ctx.addIssue({code: 'custom', message});
  if (value.resources.filter(r => r.kind === 'world').length !== 1) error('세계는 하나여야 해요.');
  if (new Set(value.resources.map(r => r.id)).size !== value.resources.length || new Set(value.starts.map(s => s.id)).size !== value.starts.length) error('중복된 항목 ID가 있어요.');
  const places = new Set(value.resources.filter(r => r.kind === 'place').map(r => r.id));
  const resources = new Set(value.resources.map(r => r.id));
  if (!value.starts.some(s => s.id === value.defaultStartId)) error('기본 시작 상황을 찾을 수 없어요.');
  for (const resource of value.resources) if (resource.activation.locations.some(location => !places.has(location))) error('포함 조건에 없는 장소가 연결되어 있어요.');
  for (const start of value.starts) {
    if (start.locationId && !places.has(start.locationId)) error('시작 장소를 찾을 수 없어요.');
    if (start.activeIds.some(active => !resources.has(active))) error('시작 상황에 없는 항목이 연결되어 있어요.');
  }
});
export type CardResource = z.infer<typeof resourceSchema>;
export type StartSituation = z.infer<typeof startSchema>;
export type CardExperience = z.infer<typeof experienceSchema>;
export const sceneStateSchema = z.object({startId: id, locationId: id.nullable(), activeIds: z.array(id).max(100), disabledIds: z.array(id).max(100), flags: z.record(flagKey, z.string().max(300))}).strict();
export type SceneState = z.infer<typeof sceneStateSchema>;

export function newResource(kind: CardResource['kind'], resourceId: string, name: string): CardResource {
  return {id: resourceId, kind, name, prompt: '', assetIds: [], activation: {enabled: true, mode: kind === 'world' ? 'always' : kind === 'place' ? 'conditional' : 'manual', locations: [], conditions: []}};
}
export function newStart(startId: string, name: string): StartSituation {return {id: startId, name, prompt: '', greeting: '', locationId: null, activeIds: [], flags: {}};}

/** Legacy cards remain readable; the first structural edit preserves their prompts. */
export function getExperience(card: Card): CardExperience {
  if (card.experience) return card.experience;
  const d = card.body.kind === 'template' ? card.body.data : null;
  const world = {...newResource('world', 'world', '세계'), prompt: [d?.world, d?.era, d?.rules].filter(Boolean).join('\n\n')};
  const character = {...newResource('character', 'character', d?.characterName || '인물'), prompt: [d?.role, d?.personality, d?.relationship].filter(Boolean).join('\n\n')};
  const hasCharacter = !!(d?.characterName || character.prompt);
  const start = {...newStart('start', '기본 시작'), greeting: d?.greeting ?? '', activeIds: hasCharacter ? [character.id] : []};
  return {version: 1, resources: hasCharacter ? [world, character] : [world], starts: [start], defaultStartId: start.id, direction: d?.tone ?? ''};
}
export function initialScene(experience: CardExperience, startId = experience.defaultStartId): SceneState {
  const start = experience.starts.find(s => s.id === startId);
  if (!start) throw new Error('시작 상황을 찾을 수 없어요.');
  return {startId, locationId: start.locationId, activeIds: [...start.activeIds], disabledIds: [], flags: {...start.flags}};
}
export function normalizeScene(experience: CardExperience, value?: SceneState | null): SceneState {
  if (!value) return initialScene(experience);
  const ids = new Set(experience.resources.map(r => r.id));
  return {...value, startId: experience.starts.some(s => s.id === value.startId) ? value.startId : experience.defaultStartId,
    locationId: experience.resources.some(r => r.id === value.locationId && r.kind === 'place') ? value.locationId : null,
    activeIds: value.activeIds.filter(id => ids.has(id)), disabledIds: value.disabledIds.filter(id => ids.has(id))};
}
export function isAvailable(resource: CardResource, state: SceneState) {
  return resource.activation.enabled && !state.disabledIds.includes(resource.id) && resource.activation.conditions.every(c => c.operator === 'is' ? (state.flags[c.key] ?? '') === c.value : (state.flags[c.key] ?? '') !== c.value);
}
export function activeResources(experience: CardExperience, state: SceneState) {
  return experience.resources.filter(r => {
    if (r.kind === 'world') return true;
    if (!isAvailable(r, state)) return false;
    if (r.kind === 'place') return r.id === state.locationId;
    if (r.activation.mode === 'manual') return state.activeIds.includes(r.id);
    if (r.activation.mode === 'conditional' && r.activation.locations.length) return r.activation.locations.includes(state.locationId ?? '');
    return true;
  });
}
export function experienceContext(card: Card, saved?: SceneState | null) {
  const experience = getExperience(card), state = normalizeScene(experience, saved);
  const start = experience.starts.find(s => s.id === state.startId)!;
  const active = activeResources(experience, state);
  return [`제목: ${card.title}`, `소개: ${card.description}`, `시작 상황: ${start.name}\n${start.prompt}`,
    `현재 상태: ${JSON.stringify(state.flags)}`, ...active.map(r => `[${resourceLabels[r.kind]}: ${r.name}]\n${r.prompt}`),
    `대화 지침: ${experience.direction}`].join('\n\n');
}
export function removeResource(experience: CardExperience, resourceId: string): CardExperience {
  if (experience.resources.find(r => r.id === resourceId)?.kind === 'world') throw new Error('세계는 삭제할 수 없어요.');
  return {...experience, resources: experience.resources.filter(r => r.id !== resourceId).map(r => ({...r, activation: {...r.activation, locations: r.activation.locations.filter(id => id !== resourceId)}})),
    starts: experience.starts.map(s => ({...s, locationId: s.locationId === resourceId ? null : s.locationId, activeIds: s.activeIds.filter(id => id !== resourceId)}))};
}
export function assetReferences(card: Card) {
  return [...new Set([...(card.coverAssetId ? [card.coverAssetId] : []), ...(card.experience?.resources.flatMap(r => r.assetIds) ?? [])])];
}
