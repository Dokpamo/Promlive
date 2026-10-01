import {expect, it} from 'vitest';
import {inputLayout, inputMetrics} from '../src/ui/chat-input/geometry';
import {groupedMessage, previewConversation} from '../src/ui/chatConversation';
import {decodeScreenSnapshot, initialScreenData, initialScreenView} from '../src/ui/screenState';

it('reserves both rows from the start and adds only text height for wrapped lines', () => {
  const m = inputMetrics(412), empty = inputLayout(m, 0, false), one = inputLayout(m, m.line, false), two = inputLayout(m, m.line * 2, false);
  expect(empty.height).toBe(one.height);
  expect(empty.height).toBe(106);
  expect(two.height).toBeCloseTo(127.333333);
  expect(m.gap).toBeCloseTo(14 * 412 / 618);
  expect(m.radius).toBeCloseTo(25.333333);
  expect(inputLayout(m, m.line * 30, false).textHeight).toBe(m.line * 7);
  expect(inputLayout(m, m.line * 30, false).scrollable).toBe(true);
  const large = inputMetrics(320, 2);
  expect(large.actionSize).toBeGreaterThanOrEqual(44);
  expect(inputLayout(large, large.line * 2, false).textHeight).toBe(large.line * 2);
});

it('groups only nearby messages from the same side and leaves separate conversations apart', () => {
  const messages = previewConversation('night-library', '마지막 답장', Date.now()).messages;
  expect(groupedMessage(messages, 2)).toEqual({before: false, after: true});
  expect(groupedMessage(messages, 3)).toEqual({before: true, after: false});
  const spaced = [{...messages[2]!, sentAt: 1}, {...messages[3]!, sentAt: 500_000}];
  expect(groupedMessage(spaced, 0).after).toBe(false);
});

it('upgrades old saved cards and conversations without replacing existing edits or clearing navigation', () => {
  const data = initialScreenData();
  const saved = JSON.parse(JSON.stringify({version: 1, savedAt: 1, data, view: {...initialScreenView(), detailCardId: 'night-library'}, positions: {}}));
  for (const card of saved.data.cards) for (const content of [card.draft, card.published]) if (content) {
    delete content.tags; delete content.gallery; delete content.guide;
  }
  for (const chat of saved.data.chats) {delete chat.messages; delete chat.draft; delete chat.draftImage;}
  saved.data.cards.find((card: {id: string}) => card.id === 'night-library').draft.summary = '직접 수정한 소개';
  const decoded = decodeScreenSnapshot(JSON.stringify(saved))!;
  const card = decoded.data.cards.find(card => card.id === 'night-library')!;
  expect(card.draft.summary).toBe('직접 수정한 소개');
  expect(card.published!.gallery).toHaveLength(3);
  expect(card.published!.tags.length).toBeGreaterThan(0);
  expect(decoded.data.chats[0]!.messages.length).toBeGreaterThan(1);
  expect(decoded.view.detailCardId).toBe('night-library');
});
