import {createContext, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {Animated, Keyboard, Platform, View, useWindowDimensions, type KeyboardEvent} from 'react-native';

const KeyboardFrame = createContext({height: 0, offset: new Animated.Value(0)});
export function ChatKeyboardProvider({children}: {children: ReactNode}) {
  const {height: windowHeight} = useWindowDimensions();
  const offset = useRef(new Animated.Value(0)).current, [height, setHeight] = useState(0);
  useEffect(() => {
    const update = (event: KeyboardEvent, hidden = false) => {
      const next = hidden ? 0 : Math.max(0, windowHeight - event.endCoordinates.screenY);
      setHeight(next); offset.stopAnimation();
      if (!event.duration) offset.setValue(next);
      else Animated.timing(offset, {toValue: next, duration: event.duration, useNativeDriver: true}).start();
    };
    const frame = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow', event => update(event));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', event => update(event, true));
    return () => {frame.remove(); hide.remove(); offset.stopAnimation();};
  }, [offset, windowHeight]);
  return <KeyboardFrame.Provider value={{height, offset}}><View style={{flex: 1}}>{children}</View></KeyboardFrame.Provider>;
}
export function useChatKeyboard() {return useContext(KeyboardFrame);}
export function dismissChatKeyboard() {Keyboard.dismiss();}
export function ChatKeyboardDock({children, safeBottom}: {children: ReactNode; safeBottom: number}) {
  const {offset} = useChatKeyboard();
  const y = offset.interpolate({inputRange: [0, safeBottom || 0.001, 10000], outputRange: [0, 0, -(10000 - safeBottom)], extrapolate: 'clamp'});
  return <Animated.View pointerEvents="box-none" style={{position: 'absolute', inset: 0, transform: [{translateY: y}]}}>{children}</Animated.View>;
}
