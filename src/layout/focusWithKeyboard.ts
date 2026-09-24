import {findNodeHandle, NativeModules, Platform, type TextInput} from 'react-native';

/** Start the editor entrance when the IME starts, rather than after it has opened. */
export function focusWithKeyboard(input: TextInput | null, onKeyboardStart?: () => void) {
  const keyboard = Platform.OS === 'android' ? NativeModules.PromliveKeyboard : undefined;
  const tag = input && keyboard ? findNodeHandle(input) : null;
  // Arm before focus requests the IME. Visible/hardware keyboards resolve immediately.
  const ready: Promise<void> | undefined = tag && onKeyboardStart && keyboard?.prepareExpansion ? keyboard.prepareExpansion(tag) : undefined;
  input?.focus();
  // A menu's native window may still be closing. Show once this editor's window
  // owns focus, rather than losing the keyboard request behind the outgoing menu.
  if (tag) keyboard?.showForInput?.(tag);
  if (ready && onKeyboardStart) void ready.then(onKeyboardStart, onKeyboardStart);
  else onKeyboardStart?.();
}
