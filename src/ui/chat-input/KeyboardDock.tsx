import type {ReactNode} from 'react';
import {Keyboard, View} from 'react-native';

// Browser/desktop keyboards do not cover this viewport. Mobile platforms use
// native layout, without a separate JS animation or keyboard-end correction.
export function ChatKeyboardProvider({children}: {children: ReactNode}) {
  return <View style={{flex: 1}}>{children}</View>;
}
export function ChatKeyboardBody({children}: {children: ReactNode}) {
  return <View style={{flex: 1, minHeight: 0}}>{children}</View>;
}
export function dismissChatKeyboard() {Keyboard.dismiss();}
export function ChatKeyboardDock({children}: {children: ReactNode; safeBottom: number}) {
  return <View pointerEvents="box-none" style={{position: 'absolute', inset: 0}}>{children}</View>;
}
