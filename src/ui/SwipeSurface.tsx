import {createContext, useContext, type ReactNode} from 'react';
import {View} from 'react-native';
import {HorizontalGesture} from './HorizontalGesture';
import type {HorizontalGestureProps} from './HorizontalGesture.types';

export const SwipeContext = createContext<Omit<HorizontalGestureProps, 'children' | 'testID'> | null>(null);

/** Only list/body areas participate; the header and horizontal chip strip remain independent. */
export function SwipeSurface({children, testID}: {children: ReactNode; testID?: string}) {
  const gesture = useContext(SwipeContext);
  return gesture ? <HorizontalGesture {...gesture} {...(testID ? {testID} : {})}>{children}</HorizontalGesture>
    : <View style={{flex: 1, minHeight: 0}}>{children}</View>;
}
