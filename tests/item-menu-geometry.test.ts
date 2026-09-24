import {expect, it} from 'vitest';
import {itemMenuGeometry, type MenuBounds, type MenuPoint} from '../src/layout/itemMenuGeometry';

const panel = {left: 14, top: 175, width: 320, height: 580};
const viewport = {left: 0, top: 24, width: 412, height: 866};
const place = (anchor: MenuBounds, screen = viewport, point?: MenuPoint) => itemMenuGeometry({panel, anchor, ...(point ? {point} : {}), viewport: screen, width: 230, height: 230, inset: 10, gap: 5});
const row = (top: number) => ({left: 24, top, width: 300, height: 50});

it('attaches the menu below an upper row, instead of leaving a gap to reach the screen center', () => {
  const anchor = row(188);
  const menu = place(anchor);
  expect(menu.top).toBe(anchor.top + anchor.height + 5);
  expect(menu.left + menu.width / 2).toBe(anchor.left + anchor.width / 2);
  expect(menu.originY).toBe(0);
  expect(place(row(248)).top - menu.top).toBe(60);
});

it('opens above a lower row with its bottom edge attached to that row', () => {
  const anchor = row(665);
  const menu = place(anchor);
  expect(menu.top + menu.height).toBe(anchor.top - 5);
  expect(menu.originY).toBe(menu.height);
});

it('chooses the side closer to the screen center when both sides fit', () => {
  const anchor = row(450);
  const menu = place(anchor);
  const center = viewport.top + viewport.height / 2;
  expect(menu.top + menu.height).toBe(anchor.top - 5);
  expect(Math.abs(menu.top + menu.height / 2 - center)).toBeLessThan(Math.abs(anchor.top + anchor.height + 5 + menu.height / 2 - center));
});

it('follows the actual horizontal press instead of fixing the menu to the right', () => {
  const anchor = row(350);
  const left = place(anchor, viewport, {x: 40, y: 375});
  const middle = place(anchor, viewport, {x: 174, y: 375});
  const right = place(anchor, viewport, {x: 308, y: 375});
  expect(left.left).toBe(24);
  expect(left.left).toBeLessThan(middle.left);
  expect(middle.left).toBeLessThan(right.left);
  expect(right.left + right.width).toBe(324);
  for (const [menu, x] of [[left, 40], [middle, 174], [right, 308]] as const) {
    expect(menu.left + menu.originX).toBe(x);
  }
});

it('keeps the entire target visible regardless of where inside it the finger presses', () => {
  for (const offset of [1, 25, 49]) {
    const upper = place(row(188), viewport, {x: 180, y: 188 + offset});
    const lower = place(row(665), viewport, {x: 180, y: 665 + offset});
    expect(upper.top).toBe(188 + 50 + 5);
    expect(upper.originY).toBe(0);
    expect(lower.top + lower.height).toBe(665 - 5);
    expect(lower.originY).toBe(lower.height);
  }
});

it('reduces the menu height to the available side rather than covering the target in a short window', () => {
  const anchor = row(320);
  const menu = place(anchor, {...viewport, height: 490}, {x: 150, y: 345});
  expect(menu.height).toBe(130);
  expect(menu.top).toBe(185);
  expect(menu.top + menu.height).toBe(anchor.top - 5);
});

it('stays inside the visible panel after scrolling to a clipped row or shrinking the window', () => {
  for (const screen of [viewport, {...viewport, height: 330}]) {
    for (const top of [150, 210, 450, 720]) {
      for (const point of [undefined, {x: 25, y: top + 1}, {x: 333, y: top + 49}]) {
        const menu = place(row(top), screen, point);
        expect(menu.top).toBeGreaterThanOrEqual(Math.max(panel.top, screen.top) + 10);
        expect(menu.top + menu.height).toBeLessThanOrEqual(Math.min(panel.top + panel.height, screen.top + screen.height) - 10);
        expect(menu.left).toBeGreaterThanOrEqual(panel.left + 10);
        expect(menu.left + menu.width).toBeLessThanOrEqual(panel.left + panel.width - 10);
        expect(menu.originX).toBeGreaterThanOrEqual(0);
        expect(menu.originX).toBeLessThanOrEqual(menu.width);
        expect(menu.originY).toBeGreaterThanOrEqual(0);
        expect(menu.originY).toBeLessThanOrEqual(menu.height);
        expect(menu.top + menu.height <= top - 5 || menu.top >= top + 50 + 5).toBe(true);
      }
    }
  }
});
