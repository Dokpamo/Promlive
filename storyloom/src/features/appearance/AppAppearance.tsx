import {createContext, useContext, useEffect, useMemo, type ReactNode} from 'react';
import {NativeModules, Platform, StatusBar, useColorScheme} from 'react-native';
import {darkChatColors, lightChatColors} from '../chat/chatAppearance';

export type ThemeMode = 'dark' | 'light' | 'system';
export const themeSettingKey = 'appearance:theme';
export const themeLabels: Record<ThemeMode, string> = {dark: '다크', light: '라이트', system: '시스템'};
export function storedTheme(value: string | undefined): ThemeMode {
  return value === 'light' || value === 'system' ? value : 'dark';
}

const darkSettings = {background: '#111111', surface: '#1F1F1F', control: '#292929', selected: '#2A2A2A', text: '#EFEFEF', secondary: '#969696', faint: '#727272', divider: '#2D2D2D', icon: '#C6C6C6', accent: '#B4C8BF', switchOff: '#464646'};
export type SettingsPalette = typeof darkSettings;
const lightSettings: SettingsPalette = {background: '#F5F5F5', surface: '#FFFFFF', control: '#FFFFFF', selected: '#EEEEEE', text: '#1D1D1D', secondary: '#777777', faint: '#909090', divider: '#EEEEEE', icon: '#505050', accent: '#517B69', switchOff: '#D4D4D4'};

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
