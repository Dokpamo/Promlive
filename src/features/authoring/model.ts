import {z} from 'zod';
import {cardSchema, type Card, type World} from '../cards/model';
import {experienceSchema, getExperience, resourceSchema, startSchema} from '../cards/experience';
import {defaultPocket, pocketSchema} from '../cards/pocket';

export const fieldLabels = {
  title: '제목', description: '소개', genre: '장르', tags: '태그', pocket: '포켓 상태창', characterName: '이름',
  personality: '성격과 말투', role: '역할과 배경', relationship: '사용자와의 관계',
  world: '세계관', era: '시대와 장소', rules: '세계의 규칙', greeting: '시작 상황', tone: '대화 지침', structure: '카드 구성',
} as const;
export type AuthoringField = keyof typeof fieldLabels | `resource:${string}` | `start:${string}`;
export const fieldNames = Object.keys(fieldLabels) as (keyof typeof fieldLabels)[];
export const fieldSchema = z.union([z.enum(fieldNames as [keyof typeof fieldLabels, ...(keyof typeof fieldLabels)[]]), z.string().regex(/^(resource|start):[a-zA-Z0-9_-]{1,100}$/).transform(value => value as AuthoringField)]);
export const fieldLabel = (field: AuthoringField) => field.startsWith('resource:') ? '구성 항목' : field.startsWith('start:') ? '시작 상황' : fieldLabels[field as keyof typeof fieldLabels];
export const structuredField = (field: AuthoringField) => field === 'pocket' || field === 'structure' || field.startsWith('resource:') || field.startsWith('start:');
export const fieldLimit = (field: AuthoringField) => structuredField(field) ? 2000000 : ({title: 120, description: 500, genre: 40, tags: 1400, characterName: 100} as Partial<Record<AuthoringField, number>>)[field] ?? 30000;
export const studioCardSchema = cardSchema.extend({title: z.string().max(120)});
export const changeSchema = z.object({field: fieldSchema, value: z.string().max(2000000)}).strict().superRefine((value, ctx) => {
  if (value.value.length > fieldLimit(value.field)) ctx.addIssue({code: 'custom', message: `${fieldLabel(value.field)}의 길이 제한을 넘었어요.`});
});
export type FieldChange = z.infer<typeof changeSchema>;
export const authoringReplySchema = z.object({
  kind: z.enum(['reply', 'question', 'change']),
  message: z.string().max(3000),
  changes: z.array(changeSchema).max(100),
}).strict().superRefine((value, ctx) => {
  if ((value.kind === 'change') !== (value.changes.length > 0)) ctx.addIssue({code: 'custom', message: '변경 결과의 형식이 맞지 않아요.'});
  if (new Set(value.changes.map(c => c.field)).size !== value.changes.length) ctx.addIssue({code: 'custom', message: '같은 항목을 중복 변경할 수 없어요.'});
  if (value.changes.some(c => c.field === 'structure') && value.changes.some(c => c.field.startsWith('resource:') || c.field.startsWith('start:'))) ctx.addIssue({code: 'custom', message: '전체 구성과 개별 항목을 동시에 바꿀 수 없어요.'});
});
export type AuthoringReply = z.infer<typeof authoringReplySchema>;

const messageSchema = z.object({
  id: z.string(), role: z.enum(['user', 'assistant']), text: z.string().max(10000),
  status: z.enum(['completed', 'generating', 'applied', 'conflict', 'cancelled', 'failed', 'interrupted']),
  changeId: z.string().optional(), createdAt: z.number(),
});
const receiptSchema = z.object({
  id: z.string(), before: z.array(changeSchema), after: z.array(changeSchema),
  revision: z.number().int(), undone: z.boolean(),
});
export const projectSchema = z.object({
  version: z.literal(1), cardId: z.string(), revision: z.number().int().nonnegative(),
  baseCardRevision: z.number().int().nonnegative(), draft: studioCardSchema,
  view: z.enum(['ai', 'edit', 'preview']), prompt: z.string().max(8000),
  target: fieldSchema.nullable(), messages: z.array(messageSchema).max(300),
  changes: z.array(receiptSchema).max(100), publishedDraftRevision: z.number().int().nullable(),
});
export type AuthoringProject = z.infer<typeof projectSchema>;
export type AuthoringMessage = AuthoringProject['messages'][number];

export function newProject(card: Card, baseCardRevision = card.revision): AuthoringProject {
  return {version: 1, cardId: card.id, revision: 0, baseCardRevision, draft: card, view: 'ai', prompt: '', target: null, messages: [], changes: [], publishedDraftRevision: null};
}
export function fieldValue(card: Card, field: AuthoringField): string {
  if (field === 'tags') return (card.tags ?? (card.genre ? [card.genre] : [])).join(', ');
  if (field === 'pocket') return JSON.stringify(card.pocket ?? defaultPocket(card));
  if (field === 'structure') return JSON.stringify(getExperience(card));
  if (field.startsWith('resource:')) return JSON.stringify(getExperience(card).resources.find(r => r.id === field.slice(9)) ?? null);
  if (field.startsWith('start:')) return JSON.stringify(getExperience(card).starts.find(s => s.id === field.slice(6)) ?? null);
  if (field === 'title' || field === 'description' || field === 'genre') return card[field];
  return card.body.kind === 'template' ? card.body.data[field as keyof World] : '';
}
export function changeFields(card: Card, changes: readonly FieldChange[]): Card {
  if (card.body.kind !== 'template') throw new Error('이 카드 형식은 기존 코드 편집기를 이용해 주세요.');
  let next = {...card, body: {...card.body, data: {...card.body.data}}};
  for (const raw of changes) {
    const {field, value} = changeSchema.parse(raw);
    if (field === 'tags') next.tags = [...new Set(value.split(/[,，\n]/).map(tag => tag.trim().replace(/^#/, '')).filter(Boolean))];
    else if (field === 'pocket') next.pocket = pocketSchema.parse(JSON.parse(value));
    else if (field === 'structure') next.experience = experienceSchema.parse(JSON.parse(value));
    else if (field.startsWith('resource:')) {
      const experience = getExperience(next), resource = resourceSchema.parse(JSON.parse(value));
      const previous = experience.resources.find(r => r.id === field.slice(9));
      if (!previous || resource.id !== previous.id || resource.kind !== previous.kind) throw new Error('수정할 항목이 일치하지 않아요.');
      next.experience = experienceSchema.parse({...experience, resources: experience.resources.map(r => r.id === resource.id ? resource : r)});
    } else if (field.startsWith('start:')) {
      const experience = getExperience(next), start = startSchema.parse(JSON.parse(value));
      if (start.id !== field.slice(6) || !experience.starts.some(s => s.id === start.id)) throw new Error('수정할 시작 상황이 일치하지 않아요.');
      next.experience = experienceSchema.parse({...experience, starts: experience.starts.map(s => s.id === start.id ? start : s)});
    } else if (field === 'title' || field === 'description' || field === 'genre') next[field] = value;
    else if (next.experience) throw new Error('세계·장소·인물 또는 시작 상황 항목에서 수정해 주세요.');
    else next.body.data[field as keyof World] = value;
  }
  return studioCardSchema.parse(next);
}

/** Record what the host actually supplied, not a model's self-reported read set. */
export function contextFields(target: AuthoringField | null): AuthoringField[] {
  if (!target) return ['title', 'description', 'tags', 'structure', 'pocket'];
  if (target === 'pocket') return ['pocket', 'structure', 'title'];
  if (structuredField(target)) return [...new Set<AuthoringField>([target, 'structure', 'title', 'description'])];
  if (target === 'title' || target === 'description' || target === 'genre' || target === 'tags') return [target];
  const related: AuthoringField[] = target === 'world' || target === 'era' || target === 'rules'
    ? ['world', 'era', 'rules']
    : ['characterName', 'role', 'personality', 'relationship', 'tone'];
  return [...new Set([target, ...related])];
}
