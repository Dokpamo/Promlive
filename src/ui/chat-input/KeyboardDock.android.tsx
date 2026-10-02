import {useContext, useLayoutEffect, useState, type ReactNode} from 'react';
import {Keyboard, NativeModules, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {NativeKeyboardSurface as KeyboardView} from './NativeKeyboardSurface';
import {KeyboardViewport} from './keyboardViewport';
import {KeyboardViewportContext} from './KeyboardViewportContext';
export function ChatKeyboardProvider({children}: {children: ReactNode}) {
  const [viewport] = useState(() => new KeyboardViewport());
  return <KeyboardViewportContext.Provider value={viewport}><KeyboardView collapsable={false} keyboardRoot style={{flex: 1}}>
    <View collapsable={false} style={{flex: 1}}>{children}</View>
  </KeyboardView></KeyboardViewportContext.Provider>;
}
export function ChatKeyboardBody({children, onViewport}: {children: ReactNode; onViewport?: (height: number) => void}) {
  const safe = useSafeAreaInsets();
  const viewport = useContext(KeyboardViewportContext);
  useLayoutEffect(() => onViewport ? viewport?.subscribe(onViewport) : undefined, [viewport, onViewport]);
  return <View collapsable={false} onLayout={event => viewport?.layout(event.nativeEvent.layout.height)} style={{flex: 1, minHeight: 0}}>
    <KeyboardView collapsable={false} chatBody bottomInset={safe.bottom} style={{flex: 1, minHeight: 0}}>{children}</KeyboardView>
  </View>;
}
export function dismissChatKeyboard() {Keyboard.dismiss(); NativeModules.PromliveKeyboard?.dismiss?.();}
export function ChatKeyboardDock({children, safeBottom}: {children: ReactNode; safeBottom: number}) {
  const [translationY, setTranslationY] = useState(0);
  const viewport = useContext(KeyboardViewportContext);
  // The OS bridge moves this view on IME frames; mirror its final transform into
  // Fabric so hit testing follows the same coordinates as the visible controls.
  return <View collapsable={false} pointerEvents="box-none" style={{position: 'absolute', inset: 0}}>
    <KeyboardView collapsable={false} pointerEvents="box-none" trackDockOffset dockFraction={1} bottomInset={safeBottom}
    onKeyboardDockFrame={event => {viewport?.dock(event.nativeEvent.translationY); setTranslationY(event.nativeEvent.translationY);}}
    style={{position: 'absolute', inset: 0, transform: [{translateY: translationY}]}}>{children}</KeyboardView>
  </View>;
}
