import {expect, it} from 'vitest';
import {itemGridLayout} from '../src/layout/itemGridLayout';
import type {ItemLayout, ListItem} from '../src/layout/itemListMotion';

const item = (id: string): ItemLayout<ListItem> => ({kind: 'item', key: id, item: {id, title: id}, top: 0, height: 72});
const divider = (visible: boolean): ItemLayout<ListItem> => ({kind: 'divider', key: 'pin-divider', visible, top: 0, height: visible ? 17 : 0});

it('packs folders and covers into three columns without losing the final partial row', () => {
  const rows = itemGridLayout([item('folder'), divider(false), ...['a', 'b', 'c', 'd'].map(item)], 3, 216);
  expect(rows.filter(row => row.kind === 'grid').map(row => ({ids: row.items.map(entry => entry.id), top: row.top, height: row.height})))
    .toEqual([{ids: ['folder', 'a', 'b'], top: 0, height: 216}, {ids: ['c', 'd'], top: 216, height: 216}]);
});

it('starts unpinned cards on a new row after a full-width divider even with only one pinned card', () => {
  const rows = itemGridLayout([item('pinned'), divider(true), ...['a', 'b', 'c', 'd'].map(item)], 3, 216);
  expect(rows.map(row => row.kind === 'grid' ? {ids: row.items.map(entry => entry.id), top: row.top} : {divider: true, top: row.top, height: row.height}))
    .toEqual([{ids: ['pinned'], top: 0}, {divider: true, top: 216, height: 17}, {ids: ['a', 'b', 'c'], top: 233}, {ids: ['d'], top: 449}]);
  expect(itemGridLayout([], 3, 216)).toEqual([]);
});
