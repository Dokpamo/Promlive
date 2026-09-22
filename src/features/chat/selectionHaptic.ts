import {NativeModules, Platform} from 'react-native';

const haptics = NativeModules.PromliveHaptics as {selection: () => void} | undefined;

export function selectionHaptic() {
  if (Platform.OS === 'android') haptics?.selection();
}
