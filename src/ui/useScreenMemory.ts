import {useEffect} from 'react';
import {AppState, Platform} from 'react-native';
import type {ScreenMemory} from './ScreenMemory';

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
    if (Platform.OS === 'web') {
      window.addEventListener('pagehide', leave);
      window.addEventListener('storage', refresh);
      document.addEventListener('visibilitychange', visibility);
    }
    return () => {
      cancelAnimationFrame(frame); subscription?.remove(); void memory.flush();
      if (Platform.OS === 'web') {
        window.removeEventListener('pagehide', leave);
        window.removeEventListener('storage', refresh);
        document.removeEventListener('visibilitychange', visibility);
      }
    };
  }, [memory]);
}
