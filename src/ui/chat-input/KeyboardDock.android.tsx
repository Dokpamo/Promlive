import {createContext, useContext, useState, type ReactNode} from 'react';
import {Keyboard, NativeModules} from 'react-native';
import {NativeKeyboardSurface as KeyboardView} from './NativeKeyboardSurface';
const KeyboardFrame = createContext({height: 0});
export function ChatKeyboardProvider({children}: {children: ReactNode}) {
  const [height, setHeight] = useState(0);
  return <KeyboardView style={{flex: 1}} onKeyboardFrame={event => setHeight(Math.max(0, event.nativeEvent.height))}>
    <KeyboardFrame.Provider value={{height}}>{children}</KeyboardFrame.Provider>
  </KeyboardView>;
}
export function useChatKeyboard() {return useContext(KeyboardFrame);}
export function dismissChatKeyboard() {Keyboard.dismiss(); NativeModules.PromliveKeyboard?.dismiss?.();}
export function ChatKeyboardDock({children, safeBottom}: {children: ReactNode; safeBottom: number}) {
  const [translationY, setTranslationY] = useState(0);
  // The OS bridge moves this view on IME frames; mirror its final transform into
  // Fabric so hit testing follows the same coordinates as the visible controls.
  return <KeyboardView pointerEvents="box-none" trackDockOffset dockFraction={1} bottomInset={safeBottom}
    onKeyboardDockFrame={event => setTranslationY(event.nativeEvent.translationY)}
    style={{position: 'absolute', inset: 0, transform: [{translateY: translationY}]}}>{children}</KeyboardView>;
}
