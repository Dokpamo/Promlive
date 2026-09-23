import {createContext, useContext, useState, type ReactNode} from 'react';
import {Animated, requireNativeComponent, type NativeSyntheticEvent, type ViewProps} from 'react-native';

interface KeyboardProps extends ViewProps {
  dockFraction?: number;
  bottomInset?: number;
  freezeKeyboard?: boolean;
  followCaret?: boolean;
  anchorEditor?: boolean;
  composerGeometry?: {compactHeight: number; expandedHeight: number; footer?: boolean} | undefined;
  onKeyboardFrame?: (event: NativeSyntheticEvent<{height: number}>) => void;
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

export function KeyboardDock({children, fraction, bottomInset, freezeKeyboard, followCaret, anchorEditor = false, composerGeometry}: {children: ReactNode; fraction: Animated.AnimatedInterpolation<number>; bottomInset: number; freezeKeyboard: boolean; followCaret: boolean; anchorEditor?: boolean; composerGeometry?: KeyboardProps['composerGeometry']}) {
  return <AnimatedKeyboardView testID="keyboard-dock" pointerEvents="box-none" dockFraction={composerGeometry ? 0 : fraction} bottomInset={bottomInset} freezeKeyboard={freezeKeyboard} followCaret={followCaret} anchorEditor={anchorEditor} composerGeometry={composerGeometry} style={{position: 'absolute', inset: 0}}>{children}</AnimatedKeyboardView>;
}
