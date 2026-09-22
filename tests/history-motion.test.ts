import {expect, it, vi} from 'vitest';
import {itemListLayout} from '../src/layout/itemListMotion';
import type {Conversation} from '../src/features/chat/model';

vi.mock('react-native', () => vi.importActual('react-native-web'));

const room = (id: string, pinnedAt: number | null = null) => ({id, cardId: 'card', title: id, createdAt: 0, updatedAt: 0, pinnedAt}) as Conversation;

it('keeps stable row keys and includes the separator gap in pin and unpin destinations', () => {
  const a = room('a'), b = room('b'), c = room('c');
  const original = itemListLayout([a, b, c], 48, 15);
  const pinned = itemListLayout([{...c, pinnedAt: 1}, a, b], 48, 15);
  expect(original.map(item => [item.key, item.top, item.height])).toEqual([['pin-divider', 0, 0], ['a', 0, 48], ['b', 48, 48], ['c', 96, 48]]);
  expect(pinned.map(item => [item.key, item.top, item.height])).toEqual([['c', 0, 48], ['pin-divider', 48, 15], ['a', 63, 48], ['b', 111, 48]]);
  expect(new Set(pinned.map(item => item.key))).toEqual(new Set(original.map(item => item.key)));
  expect(itemListLayout([a, b, c], 48, 15)).toEqual(original);
});

it('does not reserve separator space when a filtered list has only pinned or only unpinned rooms', () => {
  for (const rooms of [[room('a', 1), room('b', 2)], [room('a'), room('b')]]) {
    const layout = itemListLayout(rooms, 48, 15);
    expect(layout.find(item => item.kind === 'divider')).toMatchObject({visible: false, height: 0});
    expect(layout.filter(item => item.kind === 'item').map(item => item.top)).toEqual([0, 48]);
  }
});
