import {createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {Animated, Keyboard, Platform, View, useWindowDimensions, type KeyboardEvent} from 'react-native';

const KeyboardFrame = createContext({height: 0, motion: new Animated.Value(0)});

/** Other platforms use their keyboard frame notification and timing. */
export function KeyboardMotionProvider({children}: {children: ReactNode}) {
  const window = useWindowDimensions();
  const motion = useRef(new Animated.Value(0)).current;
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const change = (event: KeyboardEvent, hide = false) => {
      const next = hide ? 0 : Math.max(0, window.height - event.endCoordinates.screenY);
      setHeight(next);
      // Expansion blends layout and keyboard motion, so both stay on one driver.
      Animated.timing(motion, {toValue: next, duration: event.duration || 250, useNativeDriver: false}).start();
    };
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow', event => change(event));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', event => change(event, true));
    return () => {show.remove(); hide.remove(); motion.stopAnimation();};
  }, [motion, window.height]);
  return <KeyboardFrame.Provider value={{height, motion}}><View style={{flex: 1}}>{children}</View></KeyboardFrame.Provider>;
}

export function useKeyboardFrame() {return useContext(KeyboardFrame);}

export function KeyboardDock({children, fraction, bottomInset, freezeKeyboard}: {children: ReactNode; fraction: Animated.AnimatedInterpolation<number>; bottomInset: number; freezeKeyboard: boolean; followCaret: boolean; anchorEditor?: boolean; composerGeometry?: {compactHeight: number; expandedHeight: number; footer?: boolean} | undefined}) {
  const {motion} = useContext(KeyboardFrame);
  const live = useRef(0);
  const frozen = useRef(new Animated.Value(0)).current;
  useEffect(() => {const id = motion.addListener(({value}) => {live.current = value;}); return () => motion.removeListener(id);}, [motion]);
  useLayoutEffect(() => {if (freezeKeyboard) frozen.setValue(live.current);}, [freezeKeyboard, frozen]);
  const offset = (freezeKeyboard ? frozen : motion).interpolate({inputRange: [0, bottomInset || 0.001, 10000], outputRange: [0, 0, 10000 - bottomInset], extrapolate: 'clamp'});
  return <Animated.View testID="keyboard-dock" pointerEvents="box-none" style={{position: 'absolute', inset: 0, transform: [{translateY: Animated.multiply(Animated.multiply(offset, fraction), -1)}]}}>{children}</Animated.View>;
}
