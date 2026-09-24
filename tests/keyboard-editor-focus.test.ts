import {afterEach, expect, it, vi} from 'vitest';
import type {TextInput} from 'react-native';
import {focusWithKeyboard} from '../src/layout/focusWithKeyboard';

const native = vi.hoisted(() => ({
  Platform: {OS: 'android'}, findNodeHandle: vi.fn(() => 42),
  prepareExpansion: vi.fn(), showForInput: vi.fn(),
}));
vi.mock('react-native', () => ({
  Platform: native.Platform, findNodeHandle: native.findNodeHandle,
  NativeModules: {PromliveKeyboard: {prepareExpansion: native.prepareExpansion, showForInput: native.showForInput}},
}));
afterEach(() => {vi.resetAllMocks(); native.Platform.OS = 'android'; native.findNodeHandle.mockReturnValue(42);});

it('arms the IME callback before focus and starts the entrance when the keyboard begins', async () => {
  const calls: string[] = [];
  let start!: () => void;
  native.prepareExpansion.mockImplementation(() => {calls.push('prepare'); return new Promise<void>(resolve => {start = resolve;});});
  native.showForInput.mockImplementation(() => {calls.push('show');});
  const input = {focus: () => {calls.push('focus');}} as TextInput;
  focusWithKeyboard(input, () => {calls.push('entrance');});
  expect(calls).toEqual(['prepare', 'focus', 'show']);
  start(); await Promise.resolve();
  expect(calls).toEqual(['prepare', 'focus', 'show', 'entrance']);
});

it('requests the keyboard for a menu-launched name editor in its own focused window', () => {
  const input = {focus: vi.fn()} as unknown as TextInput;
  focusWithKeyboard(input);
  expect(input.focus).toHaveBeenCalledOnce();
  expect(native.showForInput).toHaveBeenCalledExactlyOnceWith(42);
  expect(native.prepareExpansion).not.toHaveBeenCalled();
});

it('still opens when keyboard preparation fails', async () => {
  native.prepareExpansion.mockRejectedValueOnce(new Error('unavailable'));
  const open = vi.fn();
  focusWithKeyboard({focus: vi.fn()} as unknown as TextInput, open);
  await Promise.resolve();
  expect(open).toHaveBeenCalledOnce();
});

it('focuses immediately without native handles on web', () => {
  native.Platform.OS = 'web';
  const input = {focus: vi.fn()} as unknown as TextInput, open = vi.fn();
  focusWithKeyboard(input, open);
  expect(input.focus).toHaveBeenCalledOnce();
  expect(open).toHaveBeenCalledOnce();
  expect(native.findNodeHandle).not.toHaveBeenCalled();
});
