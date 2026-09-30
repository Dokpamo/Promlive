import {createContext} from 'react';
import type {Animated} from 'react-native';
import type {RootPageKey} from './swipeNavigation';

export type HeaderMotion = {readHidden: () => number; adoptHidden: (hidden: number) => void};
export const BodyPageContext = createContext<{key: RootPageKey; offset: number; headerVisible: boolean}>({
  key: 'library:all', offset: 0, headerVisible: true,
});

/** The active header is outside the two adjacent bodies' translation layers. */
export const BodyMotionContext = createContext<{
  translateX: Animated.AnimatedSubtraction<number>;
  moving: boolean;
  registerHeader: (key: RootPageKey, header: HeaderMotion) => () => void;
} | null>(null);
