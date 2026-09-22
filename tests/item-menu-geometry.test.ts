import {expect, it} from 'vitest';
import {itemMenuGeometry, type MenuBounds} from '../src/layout/itemMenuGeometry';

const panel = {left: 14, top: 175, width: 320, height: 580};
const viewport = {left: 0, top: 24, width: 412, height: 866};
const place = (anchor: MenuBounds, screen = viewport) => itemMenuGeometry({panel, anchor, viewport: screen, width: 230, height: 230, inset: 10, gap: 5});
const row = (top: number) => ({left: 24, top, width: 300, height: 50});

it('attaches the menu below an upper row, instead of leaving a gap to reach the screen center', () => {
  const anchor = row(188);
  const menu = place(anchor);
  expect(menu.top).toBe(anchor.top + anchor.height + 5);
  expect(menu.left + menu.width).toBe(panel.left + panel.width - 10);
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

it('stays inside the visible panel after scrolling to a clipped row or shrinking the window', () => {
  for (const screen of [viewport, {...viewport, height: 330}]) {
    for (const top of [150, 210, 450, 720]) {
      const menu = place(row(top), screen);
      expect(menu.top).toBeGreaterThanOrEqual(Math.max(panel.top, screen.top) + 10);
      expect(menu.top + menu.height).toBeLessThanOrEqual(Math.min(panel.top + panel.height, screen.top + screen.height) - 10);
      expect(menu.left).toBeGreaterThanOrEqual(panel.left + 10);
      expect(menu.left + menu.width).toBeLessThanOrEqual(panel.left + panel.width - 10);
      expect(menu.originY).toBeGreaterThanOrEqual(0);
      expect(menu.originY).toBeLessThanOrEqual(menu.height);
    }
  }
});
