import {createContext, useContext, type ReactNode} from 'react';
import {View} from 'react-native';

export const DrawerGestureGuard = createContext<{current: boolean} | null>(null);

/** Text selection and horizontal cursor movement keep their normal gestures. */
export function DrawerGestureBoundary({children}: {children: ReactNode}) {
  const guard = useContext(DrawerGestureGuard);
  return <View onStartShouldSetResponderCapture={() => {if (guard) guard.current = true; return false;}}>{children}</View>;
}
