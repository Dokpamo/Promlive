import {createContext, useContext, useLayoutEffect, type ReactNode} from 'react';
import {View, type StyleProp, type ViewStyle} from 'react-native';

export const DrawerGestureGuard = createContext<{current: boolean} | null>(null);
export const DrawerModalLocks = createContext<{current: number} | null>(null);

/** Keep drawer navigation inactive while an overlay owns interaction. */
export function useDrawerModalLock(enabled = true) {
  const locks = useContext(DrawerModalLocks);
  useLayoutEffect(() => {
    if (!locks || !enabled) return;
    locks.current += 1;
    return () => {locks.current -= 1;};
  }, [enabled, locks]);
}

/** Text selection and horizontal cursor movement keep their normal gestures. */
export function DrawerGestureBoundary({children, style}: {children: ReactNode; style?: StyleProp<ViewStyle>}) {
  const guard = useContext(DrawerGestureGuard);
  return <View pointerEvents="box-none" style={style} onStartShouldSetResponderCapture={() => {if (guard) guard.current = true; return false;}}>{children}</View>;
}
