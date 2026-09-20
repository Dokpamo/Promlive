import {createContext, useContext, useEffect, useMemo, type ReactNode} from 'react';
import {NativeModules, Platform, StatusBar, useColorScheme} from 'react-native';
import {darkChatColors, lightChatColors, type ChatColors} from '../chat/chatAppearance';

export type ThemeMode = 'dark' | 'light' | 'system';
export const themeSettingKey = 'appearance:theme';
export const themeLabels: Record<ThemeMode, string> = {dark: '다크', light: '라이트', system: '시스템'};
export function storedTheme(value: string | undefined): ThemeMode {
  return value === 'light' || value === 'system' ? value : 'dark';
}

/** Settings uses the card list's palette instead of a separate accent color. */
function settingsPalette(c: ChatColors) {
  return {
    background: c.drawer, surface: c.search, sheet: c.search,
    control: c.search, selected: c.historySelected, pressed: c.historyPressed,
    text: c.text, secondary: c.muted, faint: c.placeholder, divider: c.divider,
    accent: c.text, primary: c.send, onPrimary: c.sendIcon,
    avatarBackground: c.historySelected, avatarForeground: c.muted,
  };
}
const darkSettings = settingsPalette(darkChatColors);
const lightSettings = settingsPalette(lightChatColors);
export type SettingsPalette = ReturnType<typeof settingsPalette>;

const AppearanceContext = createContext({
  mode: 'dark' as ThemeMode,
  setMode: (_mode: ThemeMode) => {},
  isDark: true,
  colors: darkChatColors,
  settings: darkSettings,
});

/** React Native's modal windows need their system-bar icons updated along with the activity. */
export function syncSystemBars(isDark: boolean) {
  if (Platform.OS === 'android') NativeModules.PromliveSystemBars?.setDarkIcons(!isDark);
}

export function AppearanceProvider({mode, setMode, children}: {mode: ThemeMode; setMode: (mode: ThemeMode) => void; children: ReactNode}) {
  const system = useColorScheme();
  const isDark = mode === 'dark' || (mode === 'system' && system !== 'light');
  const colors = isDark ? darkChatColors : lightChatColors;
  useEffect(() => {
    syncSystemBars(isDark);
    if (Platform.OS === 'web') {
      document.documentElement.dataset.appearance = isDark ? 'dark' : 'light';
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
      document.body.style.backgroundColor = colors.background;
    }
  }, [colors, isDark]);
  const value = useMemo(() => ({mode, setMode, isDark, colors, settings: isDark ? darkSettings : lightSettings}), [mode, setMode, isDark, colors]);
  return <AppearanceContext.Provider value={value}><StatusBar barStyle={isDark ? 'light-content' : 'dark-content'}/>{children}</AppearanceContext.Provider>;
}

export function useAppearance() { return useContext(AppearanceContext); }
