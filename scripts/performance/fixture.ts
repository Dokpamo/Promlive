import type {ChatRow} from '../../src/ui/screenState';
import type {WorkCard} from '../../src/ui/cardWorkspace';
import type {StoredMessage} from '../../src/ui/workspace/types';

export const fixtureSize = {cards: 10_000, chats: 10_000, turns: 10_000, characters: 10_000};
const epoch = 1_790_000_000_000;
export const fixtureId = (index: number) => `perf-${String(index).padStart(5, '0')}`;
export const messageShapes = ['long', 'short', 'medium', 'mixed', 'spike'] as const;
export type MessageShape = typeof messageShapes[number];
export function messageLength(sequence: number, shape: MessageShape = 'long') {
  const seed = ((sequence * 1664525 + 1013904223) >>> 0);
  if (shape === 'short') return 1 + seed % 50;
  if (shape === 'medium') return 1000;
  if (shape === 'mixed') return sequence % 2 ? 100 + seed % 901 : 1000 + seed % 9001;
  if (shape === 'spike') return sequence % 37 === 0 ? 50000 : 20 + seed % 181;
  return 10000;
}
/** Pure deterministic BMP text. No language model, network, credentials or user data. */
export function dummyText(index: number, role: string, length = fixtureSize.characters) {
  const lines: string[] = [];
  let size = 0, line = 0;
  while (size < length) {
    const text = `[${String(index).padStart(5, '0')} ${role} ${String(++line).padStart(3, '0')}] 성능 검사용 더미 문장입니다. 가나다라마바사 아자차카타파하. 화면의 글자와 스크롤 위치를 확인합니다. 0123456789\n\n`;
    lines.push(text); size += text.length;
  }
  return lines.join('').slice(0, length);
}
export function fixtureCard(index: number): WorkCard {
  const content = {title: `성능 카드 ${String(index).padStart(5, '0')}`, character: `캐릭터 ${index}`, creator: '더미 제작자', tile: index % 12,
    summary: `목록 확인용 소개 ${index}. 카드 본문은 정확히 10,000자입니다.`, introduction: dummyText(index, '카드'),
    guide: '', tags: ['더미', `분류 ${index % 12}`], gallery: [{id: `gallery-${index}`, title: '기본 이미지', tile: index % 12}]};
  return {id: fixtureId(index), origin: index % 2 ? 'external' : 'created', draft: content, published: {...content},
    working: index % 3 === 0, updatedAt: epoch - index * 1000, activity: index % 2 ? 'idle' : 'recent'};
}
export function fixtureChat(index: number): ChatRow {
  return {id: fixtureId(index), title: index === 0 ? '1만 턴 · 메시지마다 1만 자' : `더미 채팅 ${String(index).padStart(5, '0')}`,
    character: `캐릭터 ${index}`, tile: index % 12, lastChatAt: epoch - index * 1000,
    lastAssistantMessage: `더미 답변 ${index}. 마지막 AI 메시지 미리보기입니다.`, draft: '', draftImage: null, messages: []};
}
export function fixtureMessage(sequence: number, chatIndex = 0, shape: MessageShape = 'long'): StoredMessage {
  const role = sequence % 2 ? 'user' : 'assistant';
  return {id: `${fixtureId(chatIndex)}-message-${sequence}`, sequence, role,
    text: dummyText(sequence, role === 'user' ? '사용자' : 'AI', messageLength(sequence, shape)), sentAt: epoch - (fixtureSize.turns * 2 - sequence) * 1000};
}
