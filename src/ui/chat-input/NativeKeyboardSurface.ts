import {requireNativeComponent, type NativeSyntheticEvent, type ViewProps} from 'react-native';

type Props = ViewProps & {trackDockOffset?: boolean; dockFraction?: number; bottomInset?: number;
  onKeyboardFrame?: (event: NativeSyntheticEvent<{height: number}>) => void;
  onKeyboardDockFrame?: (event: NativeSyntheticEvent<{translationY: number}>) => void};

// Keep registration outside the React refresh boundary used by the dock.
export const NativeKeyboardSurface = requireNativeComponent<Props>('PromliveKeyboardView');
