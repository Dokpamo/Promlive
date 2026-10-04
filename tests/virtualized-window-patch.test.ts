import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';

// Exercise the installed dependency's transition, not a copy of our patch.
// Native rendering is checked by the isolated release-app recordings.
const source = readFileSync('node_modules/@react-native/virtualized-lists/Lists/VirtualizedList.js', 'utf8');
const method = source.slice(source.indexOf('  static getDerivedStateFromProps('), source.indexOf('\n  _pushCells('));
const body = method.slice(method.indexOf('// first and last'), method.lastIndexOf('}')).replace('Adjustment: ?number', 'Adjustment');
const transition = new Function('VirtualizedList', 'newProps', 'prevState', body);
const helpers = {
  _getItemKey: (p: {data: number[]}, index: number) => String(p.data[index]),
  _findItemIndexWithKey: (p: {data: number[]}, key: string) => {const i = p.data.findIndex(v => String(v) === key); return i < 0 ? null : i;},
  _constrainToItemCount: (range: unknown) => range,
  _createRenderMask: (p: {data: number[]}) => ({numCells: () => p.data.length}),
};
const rows = (start: number, count: number) => Array.from({length: count}, (_, i) => start + i);
function change(before: number[], after: number[]) {
  return transition(helpers, {data: after, getItemCount: (data: number[]) => data.length, maintainVisibleContentPosition: {minIndexForVisible: 0}}, {
    positionData: before, firstVisibleItemKey: String(before[0]), cellsAroundViewport: {first: 40, last: 70},
    renderMask: {numCells: () => before.length}, pendingScrollUpdateCount: 0,
  });
}
it('keeps the same messages mounted when a full window evicts its head', () => {
  const next = change(rows(100, 176), rows(116, 160));
  expect(next.cellsAroundViewport).toEqual({first: 24, last: 54});
  expect(next.pendingScrollUpdateCount).toBe(1);
});
it('also handles replacement at the same message count', () => {
  expect(change(rows(100, 160), rows(116, 160)).cellsAroundViewport).toEqual({first: 24, last: 54});
});
it('preserves prepend behavior and the previous data reference for the next eviction', () => {
  const after = rows(84, 176), next = change(rows(100, 160), after);
  expect(next.cellsAroundViewport).toEqual({first: 56, last: 86});
  expect(next.positionData).toBe(after);
});
it('does not shift a same-key update or an unrelated replacement', () => {
  expect(change(rows(100, 160), rows(100, 160)).cellsAroundViewport).toEqual({first: 40, last: 70});
  expect(change(rows(100, 160), rows(900, 160)).cellsAroundViewport).toEqual({first: 40, last: 70});
});
