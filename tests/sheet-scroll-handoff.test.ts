import {describe, expect, it} from 'vitest';
import {createSheetScrollHandoff} from '../src/layout/sheetScrollHandoff';

const scrollAt = (offset: number) => ({offset, canScroll: true, maxOffset: 300});

describe('sheet scroll handoff', () => {
  it.each([{edge: 0, direction: 1}, {edge: 300, direction: -1}])('springs back on first reaching $edge and allows dismissal only on the next touch', ({edge, direction}) => {
    const handoff = createSheetScrollHandoff();
    handoff.reset(50, 400, scrollAt(150));
    expect(handoff.move(50, 400 + direction * 50, scrollAt(150))).toBeUndefined();
    expect(handoff.move(50, 400 + direction * 200, scrollAt(edge))).toEqual({x: 0, y: 0, returnOnly: true});
    expect(handoff.move(52, 400 + direction * 300, scrollAt(edge))).toEqual({x: 2, y: direction * 100, returnOnly: true});
    expect(handoff.move(52, 400 + direction * 1200, scrollAt(edge))).toEqual({x: 2, y: direction * 1000, returnOnly: true});
    handoff.reset(50, 400, scrollAt(edge));
    expect(handoff.move(52, 400 + direction * 20, scrollAt(edge))).toEqual({x: 2, y: direction * 20});
  });

  it.each([{edge: 0, direction: 1}, {edge: 300, direction: -1}])('pulls immediately at $edge before the list has ever scrolled', ({edge, direction}) => {
    const handoff = createSheetScrollHandoff();
    handoff.reset(50, 400, scrollAt(edge));
    expect(handoff.move(50, 400 + direction * 50, scrollAt(edge))).toEqual({x: 0, y: direction * 50});
    expect(handoff.move(50, 400 + direction * 100, scrollAt(edge))).toEqual({x: 0, y: direction * 100});
    handoff.reset(50, 400, scrollAt(edge));
    expect(handoff.move(50, 400 + direction * 20, scrollAt(edge))).toEqual({x: 0, y: direction * 20});
    // A short pull may spring back. The edge stays ready until the list moves away.
    handoff.reset(50, 400, scrollAt(edge));
    expect(handoff.move(50, 400 + direction * 30, scrollAt(edge))).toEqual({x: 0, y: direction * 30});
  });

  it('gives inward movement to the list even after the edge is ready', () => {
    const handoff = createSheetScrollHandoff();
    handoff.reset(50, 100, scrollAt(0));
    handoff.move(50, 150, scrollAt(0));
    handoff.reset(50, 100, scrollAt(0));
    expect(handoff.move(50, 80, scrollAt(0))).toBeUndefined();
    expect(handoff.move(50, 150, scrollAt(0))).toEqual({x: 0, y: 0, returnOnly: true});
  });

  it('keeps a reversal and sideways movement after reaching the edge return-only', () => {
    const handoff = createSheetScrollHandoff();
    handoff.reset(50, 100, scrollAt(100));
    handoff.move(50, 150, scrollAt(30));
    handoff.move(50, 200, scrollAt(0));
    expect(handoff.move(150, 205, scrollAt(0))).toEqual({x: 100, y: 5, returnOnly: true});
    expect(handoff.move(50, 150, scrollAt(0))).toEqual({x: 0, y: -50, returnOnly: true});
    expect(handoff.move(50, 250, scrollAt(0))).toEqual({x: 0, y: 50, returnOnly: true});
  });

  it('does not move the sheet for sideways jitter before a vertical edge pull', () => {
    const handoff = createSheetScrollHandoff();
    handoff.reset(50, 100, scrollAt(100));
    handoff.move(50, 150, scrollAt(30));
    expect(handoff.move(100, 155, scrollAt(0))).toBeUndefined();
    expect(handoff.move(100, 180, scrollAt(0))).toEqual({x: 0, y: 0, returnOnly: true});
  });

  it('counts a previous fling that reached the boundary after its final move', () => {
    const handoff = createSheetScrollHandoff();
    handoff.reset(50, 100, scrollAt(100));
    handoff.move(50, 150, scrollAt(40));
    handoff.reset(50, 100, scrollAt(0));
    expect(handoff.move(50, 125, scrollAt(0))).toEqual({x: 0, y: 25});
  });

  it('requires a new stop if the list has moved away from the previously ready edge', () => {
    const handoff = createSheetScrollHandoff();
    handoff.reset(50, 100, scrollAt(0));
    handoff.move(50, 150, scrollAt(0));
    handoff.reset(50, 100, {...scrollAt(30), hasScrolled: true});
    expect(handoff.move(50, 150, scrollAt(0))).toEqual({x: 0, y: 0, returnOnly: true});
  });

  it('also respects scrolling performed without a touch pan, such as a mouse wheel', () => {
    const handoff = createSheetScrollHandoff();
    const scroll = {...scrollAt(0), hasScrolled: true};
    handoff.reset(50, 100, scroll);
    expect(handoff.move(50, 150, scroll)).toEqual({x: 0, y: 50, returnOnly: true});
    handoff.reset(50, 100, scroll);
    expect(handoff.move(50, 125, scroll)).toEqual({x: 0, y: 25});
  });

  it('keeps short sheets and fresh sideways pulls immediately draggable', () => {
    const handoff = createSheetScrollHandoff();
    handoff.reset(50, 100);
    expect(handoff.move(50, 120, {canScroll: false, offset: 0})).toEqual({x: 0, y: 20});
    handoff.reset(50, 100);
    expect(handoff.move(30, 80, {canScroll: false, offset: 0})).toEqual({x: -20, y: -20});
    handoff.reset(50, 100, scrollAt(100));
    expect(handoff.move(100, 105, scrollAt(100))).toEqual({x: 50, y: 5});
  });
});
