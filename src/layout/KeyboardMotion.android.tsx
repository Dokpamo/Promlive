import {createContext, useContext, useState, type ReactNode} from 'react';
import {Animated, requireNativeComponent, type NativeSyntheticEvent, type ViewProps} from 'react-native';
import type {EditorScrollRestore} from './editorScroll';

interface KeyboardProps extends ViewProps {
  trackDockOffset?: boolean;
  dockFraction?: number;
  bottomInset?: number;
  freezeKeyboard?: boolean;
  followCaret?: boolean;
  anchorEditor?: boolean;
  restoreScroll?: EditorScrollRestore | undefined;
  composerGeometry?: {compactHeight: number; expandedHeight: number; footer?: boolean} | undefined;
  onKeyboardFrame?: (event: NativeSyntheticEvent<{height: number}>) => void;
  onKeyboardDockFrame?: (event: NativeSyntheticEvent<{translationY: number}>) => void;
}
const NativeKeyboardView = requireNativeComponent<KeyboardProps>('PromliveKeyboardView');
const AnimatedKeyboardView = Animated.createAnimatedComponent(NativeKeyboardView);
const KeyboardFrame = createContext({height: 0});

export function KeyboardMotionProvider({children}: {children: ReactNode}) {
  const [frame, setFrame] = useState({height: 0});
  return <NativeKeyboardView style={{flex: 1}} onKeyboardFrame={event => {
    const height = Math.max(0, event.nativeEvent.height);
    setFrame(previous => previous.height === height ? previous : {height});
  }}><KeyboardFrame.Provider value={frame}>{children}</KeyboardFrame.Provider></NativeKeyboardView>;
}

export function useKeyboardFrame() {return useContext(KeyboardFrame);}

export function KeyboardDock({children, fraction, bottomInset, freezeKeyboard, followCaret, anchorEditor = false, restoreScroll, composerGeometry}: {children: ReactNode; fraction: Animated.AnimatedInterpolation<number>; bottomInset: number; freezeKeyboard: boolean; followCaret: boolean; anchorEditor?: boolean; restoreScroll?: EditorScrollRestore | undefined; composerGeometry?: KeyboardProps['composerGeometry']}) {
  const [translationY, setTranslationY] = useState(0);
  // Mirror the displayed native offset into Fabric's measured layout. The view
  // manager retains UI-thread ownership of the actual keyboard animation.
  return <AnimatedKeyboardView testID="keyboard-dock" pointerEvents="box-none" trackDockOffset
    onKeyboardDockFrame={event => setTranslationY(event.nativeEvent.translationY)}
    dockFraction={composerGeometry ? 0 : fraction} bottomInset={bottomInset} freezeKeyboard={freezeKeyboard} followCaret={followCaret} anchorEditor={anchorEditor} restoreScroll={restoreScroll} composerGeometry={composerGeometry}
    style={{position: 'absolute', inset: 0, transform: [{translateY: translationY}]}}>{children}</AnimatedKeyboardView>;
}
