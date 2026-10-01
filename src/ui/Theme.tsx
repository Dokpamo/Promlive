import {createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode} from 'react';
import {Platform, StyleSheet, useColorScheme, type ImageStyle, type TextStyle, type ViewStyle} from 'react-native';
import type {ScreenMemory} from './ScreenMemory';
import {colorPalettes} from './tokens';
import {useSettingsServices} from './settings/SettingsServices';
export type Palette = {[K in keyof typeof colorPalettes.light]: string};
const Context = createContext({appearance: 'light' as 'light' | 'dark', colors: colorPalettes.light as Palette});
const subscribe = () => () => {};
const fallback = {theme: 'light' as const, prompt: '', language: '한국어', ready: false, error: ''};
const snapshot = () => fallback;
export function ThemeProvider({children, memory}: {children: ReactNode; memory: ScreenMemory}) {
  const {services} = useSettingsServices();
  const value = useSyncExternalStore(services?.general.subscribe ?? subscribe, services?.general.snapshot ?? snapshot);
  const [cachedMode] = useState(() => memory.getSnapshot().view.themeMode);
  const mode = value.ready ? value.theme : cachedMode;
  useEffect(() => {if (value.ready) memory.updateView(view => view.themeMode === value.theme ? view : {...view, themeMode: value.theme});}, [memory, value.ready, value.theme]);
  const system = useColorScheme();
  const appearance = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const theme = useMemo(() => ({appearance, colors: colorPalettes[appearance]}), [appearance]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.style.colorScheme = appearance;
    document.body.style.backgroundColor = theme.colors.background;
  }, [theme, appearance]);
  return <Context.Provider value={theme}>{children}</Context.Provider>;
}
export const useTheme = () => useContext(Context);
export const usePalette = () => useTheme().colors;
/** Build each native stylesheet once per shared palette. */
export function themedStyles<T extends Record<string, ViewStyle | TextStyle | ImageStyle>>(factory: (colors: Palette) => T) {
  const cache = new Map<Palette, T>();
  return function useStyles() {
    const colors = usePalette();
    if (!cache.has(colors)) cache.set(colors, StyleSheet.create(factory(colors)));
    return cache.get(colors)!;
  };
}
