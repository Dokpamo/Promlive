import {expect, it} from 'vitest';
import {advanceHeaderScroll, headerSettleTarget, type HeaderScrollPosition} from '../src/ui/scrollHeaderMotion';

const start: HeaderScrollPosition = {offset: 0, hidden: 0, height: 120, maxOffset: 500};

it('moves the header by the same distance as the content, including a partial reversal', () => {
  const down = advanceHeaderScroll(start, 45, 500);
  expect(down.hidden).toBe(45);
  const reversed = advanceHeaderScroll(down, 30, 500);
  expect(reversed.hidden).toBe(30);
  expect(reversed.hidden - down.hidden).toBe(reversed.offset - down.offset);
});

it('reveals immediately by the drag distance even far down the list', () => {
  const hidden = advanceHeaderScroll(start, 400, 500);
  expect(hidden.hidden).toBe(120);
  const reversed = advanceHeaderScroll(hidden, 378, 500);
  expect(reversed.hidden).toBe(98);
  expect(headerSettleTarget(reversed)).toEqual({offset: 400});
});

it('finishes toward the nearest end by scrolling both the content and the header', () => {
  const hidden = advanceHeaderScroll(start, 400, 500);
  const mostlyOpen = advanceHeaderScroll(hidden, 320, 500);
  const target = headerSettleTarget(mostlyOpen);
  expect(target).toEqual({offset: 280});
  const snapped = advanceHeaderScroll(mostlyOpen, 280, 500);
  expect(snapped.hidden).toBe(0);
  expect(snapped.offset - mostlyOpen.offset).toBe(-mostlyOpen.hidden);
  expect(headerSettleTarget(snapped)).toBeNull();
});

it('does not treat overscroll at either edge as an opposite-direction drag', () => {
  const bottom = advanceHeaderScroll(start, 560, 500);
  expect(bottom).toMatchObject({offset: 500, hidden: 120});
  expect(advanceHeaderScroll(bottom, 500, 500).hidden).toBe(120);
  const top = advanceHeaderScroll(bottom, -30, 500);
  expect(top).toMatchObject({offset: 0, hidden: 0});
  expect(advanceHeaderScroll(top, 0, 500).hidden).toBe(0);
});

it('keeps the header visible for short lists without moving their content back to the top', () => {
  const shortList = advanceHeaderScroll(start, 80, 80);
  expect(shortList.hidden).toBe(0);
  expect(headerSettleTarget(shortList)).toBeNull();
  expect(headerSettleTarget(advanceHeaderScroll(start, 40, 0))).toBeNull();
});

it('finishes the content and header together after short and long reversals at the bottom', () => {
  const bottom = advanceHeaderScroll(start, 500, 500);
  const short = advanceHeaderScroll(bottom, 480, 500);
  expect(headerSettleTarget(short)).toEqual({offset: 500});
  const long = advanceHeaderScroll(bottom, 420, 500);
  expect(headerSettleTarget(long)).toEqual({offset: 380});
  for (const position of [short, long]) {
    const target = headerSettleTarget(position)!;
    const finished = advanceHeaderScroll(position, target.offset, 500);
    expect(finished.hidden - position.hidden).toBe(finished.offset - position.offset);
    expect(headerSettleTarget(finished)).toBeNull();
  }
});

it('can always finish a partial header within the list after repeated bottom reversals', () => {
  let position = start;
  for (const offset of [500, 480, 430, 445, 499, 420, 360, 395, 480, 460, 500]) {
    position = advanceHeaderScroll(position, offset, 500);
    const target = headerSettleTarget(position);
    if (!target) continue;
    const finished = advanceHeaderScroll(position, target.offset, 500);
    expect([0, 120]).toContain(finished.hidden);
    expect(finished.hidden - position.hidden).toBe(finished.offset - position.offset);
    expect(finished.offset).toBeGreaterThanOrEqual(0);
    expect(finished.offset).toBeLessThanOrEqual(500);
    position = finished;
  }
});

it('ignores repeated elastic rebounds at either boundary', () => {
  let position = advanceHeaderScroll(start, 500, 500);
  for (const offset of [530, 560, 520, 500]) {
    position = advanceHeaderScroll(position, offset, 500);
    expect(position.hidden).toBe(120);
    expect(headerSettleTarget(position)).toBeNull();
  }
  position = advanceHeaderScroll(position, 0, 500);
  for (const offset of [-10, -30, -5, 0]) {
    position = advanceHeaderScroll(position, offset, 500);
    expect(position.hidden).toBe(0);
    expect(headerSettleTarget(position)).toBeNull();
  }
});
