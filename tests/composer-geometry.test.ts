import {expect, it} from 'vitest';
import {composerEditorHeight, expandedComposerFrame} from '../src/features/chat/composerGeometry';

const viewport = {width: 412, height: 892};

it('keeps the sheet fixed and scrolls behind the floating controls up to the keyboard', () => {
  const sheet = expandedComposerFrame(viewport);
  const original = {...sheet};
  const withoutKeyboard = composerEditorHeight(sheet, 86, 1800, 25, 18, 892);
  const keyboardVisible = composerEditorHeight(sheet, 86, 1800, 25, 18, 554);
  expect(sheet.height).toBe(viewport.height);
  expect(sheet.y).toBe(0);
  expect(sheet.radius).toBe(0);
  expect(keyboardVisible).toBeLessThan(withoutKeyboard);
  expect(withoutKeyboard).toBeCloseTo(sheet.height);
  expect(sheet.y + keyboardVisible).toBeCloseTo(554);
  // At the scroll limits, the first and final lines clear the two controls.
  const lastLineBottom = 86 + 1800;
  const maxScroll = lastLineBottom + 18 - keyboardVisible;
  expect(lastLineBottom - maxScroll).toBeCloseTo(keyboardVisible - 18);
  expect(sheet).toEqual(original);
  expect(composerEditorHeight(sheet, 86, 1800, 25, 18, 892)).toBe(withoutKeyboard);
});

it('preserves draggable blank space for short text and a scrollable line on a very small viewport', () => {
  const sheet = expandedComposerFrame(viewport);
  expect(composerEditorHeight(sheet, 86, 50, 25, 18, 554)).toBe(154);
  expect(composerEditorHeight(sheet, 86, 1800, 25, 18, sheet.y)).toBe(25);
});

it('fills wide and short windows instead of leaving panel margins', () => {
  for (const viewport of [{width: 1024, height: 768}, {width: 892, height: 220}]) {
    expect(expandedComposerFrame(viewport)).toEqual({x: 0, y: 0, ...viewport, radius: 0});
  }
});
