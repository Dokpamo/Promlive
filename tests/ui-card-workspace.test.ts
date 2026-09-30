import {expect, it} from 'vitest';
import {cardWorkspaceReducer as reduce, createPreviewWorkspace, filteredWorkCards, publishedLibraryCards} from '../src/ui/cardWorkspace';

it('keeps new drafts out of the library until completion, without duplicating repeated completions', () => {
  let cards = createPreviewWorkspace();
  const before = publishedLibraryCards(cards);
  expect(before).toHaveLength(12);
  cards = reduce(cards, {type: 'create', id: 'new-card', now: 1});
  cards = reduce(cards, {type: 'complete', id: 'new-card', now: 2});
  expect(publishedLibraryCards(cards)).toEqual(before);
  cards = reduce(cards, {type: 'edit', id: 'new-card', field: 'title', value: '  새로운 이야기  ', now: 3});
  expect(publishedLibraryCards(cards)).toEqual(before);
  cards = reduce(cards, {type: 'complete', id: 'new-card', now: 4});
  cards = reduce(cards, {type: 'complete', id: 'new-card', now: 5});
  expect(publishedLibraryCards(cards)).toHaveLength(13);
  expect(publishedLibraryCards(cards).find(card => card.id === 'new-card')?.title).toBe('새로운 이야기');
  expect(filteredWorkCards(cards, 'ready', '').some(card => card.id === 'new-card')).toBe(true);
});

it('leaves the imported library version unchanged while its editing draft changes', () => {
  let cards = createPreviewWorkspace();
  const original = cards.find(card => card.id === 'night-library')!;
  const originalTitle = original.published!.title;
  cards = reduce(cards, {type: 'edit', id: original.id, field: 'title', value: '수정한 외부 카드', now: Date.now()});
  const edited = cards.find(card => card.id === original.id)!;
  expect(edited.origin).toBe('external');
  expect(edited.draft.title).toBe('수정한 외부 카드');
  expect(edited.published!.title).toBe(originalTitle);
  expect(original.draft.title).toBe(originalTitle);
  expect(filteredWorkCards(cards, 'draft', '').map(card => card.id)).toContain(original.id);
  expect(filteredWorkCards(cards, 'external', '').map(card => card.id)).toContain(original.id);
  cards = reduce(cards, {type: 'complete', id: original.id, now: Date.now()});
  expect(publishedLibraryCards(cards)).toHaveLength(12);
  expect(publishedLibraryCards(cards).find(card => card.id === original.id)?.title).toBe('수정한 외부 카드');
  cards = reduce(cards, {type: 'edit', id: original.id, field: 'title', value: '다음 수정', now: Date.now()});
  expect(publishedLibraryCards(cards).find(card => card.id === original.id)?.title).toBe('수정한 외부 카드');
});

it('combines search with origin and work state, ordered by the last edit', () => {
  const cards = createPreviewWorkspace();
  expect(filteredWorkCards(cards, 'mine', '')).toHaveLength(3);
  expect(filteredWorkCards(cards, 'external', '')).toHaveLength(12);
  expect(filteredWorkCards(cards, 'draft', '')).toHaveLength(3);
  expect(filteredWorkCards(cards, 'ready', '')).toHaveLength(12);
  expect(filteredWorkCards(cards, 'external', 'ｎｏａｈ').map(card => card.id)).toEqual(['orbit-cafe']);
  expect(filteredWorkCards(cards, 'mine', '도서관')).toHaveLength(0);
  const all = filteredWorkCards(cards, 'all', '');
  expect(all[0]?.id).toBe('draft-1');
  expect(all.every((card, i) => i === 0 || all[i - 1]!.updatedAt >= card.updatedAt)).toBe(true);
});
