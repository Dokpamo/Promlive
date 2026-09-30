import type {ComponentRef, ReactNode, RefObject} from 'react';
import type {Animated} from 'react-native';
import type {NativeViewGestureHandler} from 'react-native-gesture-handler';

export type GestureBlockRef = RefObject<ComponentRef<typeof NativeViewGestureHandler> | null>;

export type HorizontalGestureProps = {
  children: ReactNode;
  translation: Animated.Value;
  enabled: boolean;
  rightOnly?: boolean;
  blockers?: GestureBlockRef[];
  onStart: () => void;
  onRelease: (x: number, velocity: number, cancelled: boolean) => void;
  testID?: string;
};
