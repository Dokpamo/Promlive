import {cardContext, type Card} from '../cards/model';
import type {Message} from './model';
export function buildContext(card: Card, history: Message[], input: string, limit: number) {
  const context = cardContext(card);
  let remaining = limit - context.length - input.length - 500;
  if (remaining < 0) throw new Error('카드 설정과 입력이 너무 깁니다. 내용을 줄여 주세요.');
  const completed = history.filter(m => m.status === 'completed');
  const selected: Message[] = [];
  for (let index = completed.length - 1; index >= 0; index--) {
    const item = completed[index];
    if (!item || item.content.length > remaining) break;
    remaining -= item.content.length; selected.unshift(item);
  }
  // Never begin a provider conversation with an orphaned assistant response.
  while (selected[0]?.role === 'assistant') selected.shift();
  return {context, messages: selected.map(m => ({role: m.role, content: m.content})), omitted: history.length - selected.length};
}
