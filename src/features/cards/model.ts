import {z} from 'zod';

const text = z.string().max(30000);
export const worldSchema = z.object({
  world: text, era: text, rules: text, characterName: z.string().max(100),
  role: text, personality: text, relationship: text, greeting: text, tone: text,
});
export const bodySchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('template'), templateId: z.literal('world-character'), templateVersion: z.literal(1), data: worldSchema}),
  z.object({kind: z.literal('code'), runtime: z.literal('html-worker'), runtimeVersion: z.literal(1), source: z.object({html: text, css: text, javascript: text})}),
]);
export const cardSchema = z.object({
  id: z.string().min(1).max(100), formatVersion: z.literal(1), revision: z.number().int().nonnegative(),
  title: z.string().min(1).max(120), description: z.string().max(500),
  genre: z.string().max(40), cover: z.enum(['moon', 'forest', 'sunset', 'code']),
  favorite: z.boolean(), archived: z.boolean(), example: z.boolean(),
  pinnedAt: z.number().int().nonnegative().nullable().optional(),
  createdAt: z.number().int().nonnegative(), updatedAt: z.number().int().nonnegative(), body: bodySchema,
});
export type Card = z.infer<typeof cardSchema>;
export type World = z.infer<typeof worldSchema>;
export type CardBody = z.infer<typeof bodySchema>;
export const sourceSchema = z.object({title: z.string().max(300), url: z.url().refine(value => /^https?:\/\//.test(value))});
export const draftSchema = z.object({
  id: z.string(), cardId: z.string(), baseRevision: z.number().int().nonnegative(),
  kind: z.enum(['writing', 'research']), status: z.enum(['generating', 'completed', 'cancelled', 'failed', 'applied']),
  instruction: text, content: text, sources: z.array(sourceSchema).max(30), error: z.string().nullable(),
  createdAt: z.number().int(),
});
export type Draft = z.infer<typeof draftSchema>;
export const emptyWorld: World = {world: '', era: '', rules: '', characterName: '', role: '', personality: '', relationship: '', greeting: '', tone: ''};
export function newId(prefix = 'id') { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`; }
export function newCard(kind: CardBody['kind'] = 'template'): Card {
  const now = Date.now();
  return {id: newId('card'), formatVersion: 1, revision: 0, title: '제목 없는 이야기', description: '', genre: '오리지널', cover: kind === 'code' ? 'code' : 'moon', favorite: false, archived: false, example: false, createdAt: now, updatedAt: now,
    body: kind === 'template' ? {kind, templateId: 'world-character', templateVersion: 1, data: {...emptyWorld}} : {kind, runtime: 'html-worker', runtimeVersion: 1, source: {html: '<main><small>MY LITTLE WORLD</small><h1>이야기의 시작</h1><p id="answer">한 문장으로 세계를 열어 보세요.</p><button id="create">다음 장면 만들기</button></main>', css: 'body { background: #f3efe7; color: #433b35; font-family: system-ui; padding: 32px; } main { max-width: 520px; margin: auto; } small { letter-spacing: 3px; color: #82718e; } h1 { font-size: 30px; } p { line-height: 1.9; white-space: pre-wrap; } button { background: #76618b; color: white; border: 0; border-radius: 10px; padding: 12px 20px; cursor: pointer; }', javascript: "creator.on('click', '#create', async () => {\n  creator.text('#answer', '다음 장면을 기다리는 중…');\n  try {\n    const text = await creator.generate('밤의 도서관에서 시작하는 장면을 세 문장으로 써 줘.');\n    creator.text('#answer', text);\n  } catch (error) {\n    creator.text('#answer', error.message);\n  }\n});"}}};
}
export function cardContext(card: Card) {
  if (card.body.kind === 'code') return `제목: ${card.title}\n소개: ${card.description}`;
  const d = card.body.data;
  return `제목: ${card.title}\n소개: ${card.description}\n세계관: ${d.world}\n시대와 장소: ${d.era}\n규칙: ${d.rules}\n등장인물: ${d.characterName}\n역할: ${d.role}\n성격과 말투: ${d.personality}\n관계: ${d.relationship}\n시작 장면: ${d.greeting}\n대화 지침: ${d.tone}`;
}
