import {useEffect} from 'react';
import {NativeModules, Platform} from 'react-native';

type Theme = 'dark' | 'light' | 'system';
const startup = (Platform.OS === 'android' ? NativeModules.PromliveStartup : undefined) as {theme: Theme; ready: (theme: Theme) => void; setTheme?: (theme: Theme) => void} | undefined;

export function initialStartupTheme(): Theme {
  return startup?.theme === 'light' || startup?.theme === 'dark' ? startup.theme : 'system';
}

/** Mirror a selection immediately, before the next launch or asynchronous DB write. */
export function syncStartupTheme(theme: Theme) {startup?.setTheme?.(theme);}

/** Keep the native launch screen through restoration, then expose one ready frame. */
export function useStartupScreen(ready: boolean, theme: Theme) {
  useEffect(() => {
    if (!ready || !startup) return;
    const frame = requestAnimationFrame(() => startup.ready(theme));
    return () => cancelAnimationFrame(frame);
  }, [ready, theme]);
}
