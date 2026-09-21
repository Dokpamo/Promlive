import {createContext, useContext, useLayoutEffect, type ReactNode} from 'react';
import {View} from 'react-native';

export const DrawerGestureGuard = createContext<{current: boolean} | null>(null);
export const DrawerModalLocks = createContext<{current: number} | null>(null);

/** Keep navigation inactive for the modal's entire lifetime, including its exit animation. */
export function useDrawerModalLock() {
  const locks = useContext(DrawerModalLocks);
  useLayoutEffect(() => {
    if (!locks) return;
    locks.current += 1;
    return () => {locks.current -= 1;};
  }, [locks]);
}

/** Text selection and horizontal cursor movement keep their normal gestures. */
export function DrawerGestureBoundary({children}: {children: ReactNode}) {
  const guard = useContext(DrawerGestureGuard);
  return <View onStartShouldSetResponderCapture={() => {if (guard) guard.current = true; return false;}}>{children}</View>;
}
