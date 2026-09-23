import {expect, it} from 'vitest';
import {composerEditorHeight, expandedComposerFrame} from '../src/features/chat/composerGeometry';

const viewport = {width: 412, height: 892};
const insets = {top: 24, right: 0, bottom: 24, left: 0};

it('keeps the sheet fixed and scrolls behind the floating controls up to the keyboard', () => {
  const sheet = expandedComposerFrame(viewport, insets);
  const original = {...sheet};
  const withoutKeyboard = composerEditorHeight(sheet, 86, 1800, 25, 18, 892);
  const keyboardVisible = composerEditorHeight(sheet, 86, 1800, 25, 18, 554);
  expect(sheet.height).toBeCloseTo(viewport.height * 0.9);
  expect(sheet.y + sheet.height).toBeCloseTo(viewport.height - insets.bottom);
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
  const sheet = expandedComposerFrame(viewport, insets);
  expect(composerEditorHeight(sheet, 86, 50, 25, 18, 554)).toBe(154);
  expect(composerEditorHeight(sheet, 86, 1800, 25, 18, sheet.y)).toBe(25);
});

it('respects safe areas and the shared maximum width on wide or short windows', () => {
  const wide = expandedComposerFrame({width: 1024, height: 768}, {top: 24, right: 40, bottom: 24, left: 0});
  expect(wide.width).toBe(560);
  expect(wide.x).toBe((1024 - 40 - 560) / 2);
  const short = expandedComposerFrame({width: 892, height: 220}, {top: 40, right: 0, bottom: 32, left: 0});
  expect(short.y).toBeGreaterThan(40);
  expect(short.y + short.height).toBe(220 - 32);
});
