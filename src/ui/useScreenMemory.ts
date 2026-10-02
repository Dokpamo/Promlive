import {useEffect} from 'react';
import {AppState, Platform} from 'react-native';
import type {ScreenMemory} from './ScreenMemory';
import {screenStorageKey} from './screenPersistence';

export function useScreenMemory(memory: ScreenMemory) {
  useEffect(() => {
    const refresh = () => {void memory.refresh().then(memory.flush);};
    const frame = requestAnimationFrame(refresh);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
      else void memory.flush();
    });
    const visibility = () => {if (document.visibilityState === 'visible') refresh(); else void memory.flush();};
    const leave = () => {void memory.flush();};
    const storageChanged = (event: StorageEvent) => {
      if (event.key === null || event.key === screenStorageKey) refresh();
    };
    if (Platform.OS === 'web') {
      window.addEventListener('pagehide', leave);
      window.addEventListener('storage', storageChanged);
      document.addEventListener('visibilitychange', visibility);
    }
    return () => {
      cancelAnimationFrame(frame); subscription?.remove(); void memory.flush();
      if (Platform.OS === 'web') {
        window.removeEventListener('pagehide', leave);
        window.removeEventListener('storage', storageChanged);
        document.removeEventListener('visibilitychange', visibility);
      }
    };
  }, [memory]);
}
