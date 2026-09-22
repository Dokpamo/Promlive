import {expect, it} from 'vitest';
import {composerEditorHeight, expandedComposerFrame} from '../src/features/chat/composerGeometry';

const viewport = {width: 412, height: 892};
const insets = {top: 24, right: 0, bottom: 24, left: 0};

it('keeps a 90% sheet at the same bounds while only the editor scroll area avoids the keyboard', () => {
  const sheet = expandedComposerFrame(viewport, insets);
  const original = {...sheet};
  const withoutKeyboard = composerEditorHeight(sheet, 86, 1800, 25, 18, 892);
  const keyboardVisible = composerEditorHeight(sheet, 86, 1800, 25, 18, 554);
  expect(sheet.height).toBeCloseTo(viewport.height * 0.9);
  expect(sheet.y + sheet.height).toBeCloseTo(viewport.height - insets.bottom);
  expect(keyboardVisible).toBeLessThan(withoutKeyboard);
  expect(sheet.y + 86 + keyboardVisible + 18).toBeCloseTo(554);
  expect(sheet).toEqual(original);
  expect(composerEditorHeight(sheet, 86, 1800, 25, 18, 892)).toBe(withoutKeyboard);
});

it('preserves draggable blank space for short text and a scrollable line on a very small viewport', () => {
  const sheet = expandedComposerFrame(viewport, insets);
  expect(composerEditorHeight(sheet, 86, 50, 25, 18, 554)).toBe(50);
  expect(composerEditorHeight(sheet, 86, 1800, 25, 18, 120)).toBe(25);
});

it('respects safe areas and the shared maximum width on wide or short windows', () => {
  const wide = expandedComposerFrame({width: 1024, height: 768}, {top: 24, right: 40, bottom: 24, left: 0});
  expect(wide.width).toBe(560);
  expect(wide.x).toBe((1024 - 40 - 560) / 2);
  const short = expandedComposerFrame({width: 892, height: 220}, {top: 40, right: 0, bottom: 32, left: 0});
  expect(short.y).toBeGreaterThan(40);
  expect(short.y + short.height).toBe(220 - 32);
});
