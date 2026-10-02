import {useState, type ReactNode} from 'react';
import {Keyboard, NativeModules, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {NativeKeyboardSurface as KeyboardView} from './NativeKeyboardSurface';
export function ChatKeyboardProvider({children}: {children: ReactNode}) {
  return <KeyboardView collapsable={false} keyboardRoot style={{flex: 1}}>
    <View collapsable={false} style={{flex: 1}}>{children}</View>
  </KeyboardView>;
}
export function ChatKeyboardBody({children}: {children: ReactNode}) {
  const safe = useSafeAreaInsets();
  return <View collapsable={false} style={{flex: 1, minHeight: 0}}>
    <KeyboardView collapsable={false} chatBody bottomInset={safe.bottom} style={{flex: 1, minHeight: 0}}>{children}</KeyboardView>
  </View>;
}
export function dismissChatKeyboard() {Keyboard.dismiss(); NativeModules.PromliveKeyboard?.dismiss?.();}
export function ChatKeyboardDock({children, safeBottom}: {children: ReactNode; safeBottom: number}) {
  const [translationY, setTranslationY] = useState(0);
  // The OS bridge moves this view on IME frames; mirror its final transform into
  // Fabric so hit testing follows the same coordinates as the visible controls.
  return <View collapsable={false} pointerEvents="box-none" style={{position: 'absolute', inset: 0}}>
    <KeyboardView collapsable={false} pointerEvents="box-none" trackDockOffset dockFraction={1} bottomInset={safeBottom}
    onKeyboardDockFrame={event => setTranslationY(event.nativeEvent.translationY)}
    style={{position: 'absolute', inset: 0, transform: [{translateY: translationY}]}}>{children}</KeyboardView>
  </View>;
}
