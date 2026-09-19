import {useEffect, useState, useSyncExternalStore} from 'react';
import {ActivityIndicator, Keyboard, Pressable, Text, View, useWindowDimensions} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {initialize} from './src/app/runtime';
import {Workspace} from './src/app/workspace';
import {ChatScreen} from './src/features/chat/ChatScreen';
import {ChatDrawer} from './src/features/chat/ChatDrawer';
import {ChatHeader} from './src/features/chat/ChatHeader';
import {composerScale} from './src/features/chat/chatAppearance';
import {SettingsPreview} from './src/features/settings/SettingsPreview';
import {AppearanceProvider, storedTheme, themeSettingKey, useAppearance, type ThemeMode} from './src/features/appearance/AppAppearance';

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  useEffect(() => {
    let active = true;
    void initialize().then(async runtime => {
      const next = new Workspace(runtime);
      await next.readyChat();
      const savedTheme = storedTheme(await runtime.repo.getSetting(themeSettingKey));
      if (active) {setTheme(savedTheme); setWorkspace(next);}
    }).catch(e => {if (active) setError(e instanceof Error ? e.message : '저장소를 열지 못했어요.');});
    return () => {active = false;};
  }, []);
  const changeTheme = (mode: ThemeMode) => {
    setTheme(mode);
    if (workspace) void workspace.runtime.repo.setSetting(themeSettingKey, mode).catch(e => workspace.report(e));
  };
  return <SafeAreaProvider style={{flex: 1}}><AppearanceProvider mode={theme} setMode={changeTheme}>
    <AppContent workspace={workspace} error={error}/>
  </AppearanceProvider></SafeAreaProvider>;
}

function AppContent({workspace, error}: {workspace: Workspace | null; error: string}) {
  const {colors: c} = useAppearance();
  return (
    <View style={{flex: 1, backgroundColor: c.background}}>
      {workspace ? <ChatApp workspace={workspace}/> : <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32}}>{error ? <Text style={{color: c.text, fontSize: 15, lineHeight: 24}}>{error}</Text> : <ActivityIndicator color={c.muted}/>}</View>}
    </View>
  );
}

function ChatApp({workspace: w}: {workspace: Workspace}) {
  const {colors: c} = useAppearance();
  useSyncExternalStore(w.subscribe, w.snapshot);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = () => {Keyboard.dismiss(); setSettingsOpen(true);};
  const {width} = useWindowDimensions();
  const s = composerScale(width);
  useEffect(() => {
    if (!w.notice) return;
    const timer = setTimeout(() => {w.notice = null; w.emit();}, 3500);
    return () => clearTimeout(timer);
  }, [w, w.notice]);
  return <><ChatDrawer workspace={w} openSettings={openSettings} active={!settingsOpen}>{openHistory => <SafeAreaView edges={['top', 'left', 'right']} style={{flex: 1}}>
    <ChatHeader width={width} title={w.conversation?.title ?? '새로운 대화'} conversationId={w.conversation?.id ?? 'new'} openHistory={openHistory} openSettings={openSettings}/>
    <ChatScreen key={w.conversation?.id ?? 'new'} workspace={w} width={width}/>
    {(w.notice || w.error) && <Pressable accessibilityRole="button" accessibilityLabel="안내 닫기" onPress={() => w.clearMessage()} style={{position: 'absolute', top: 100 * s, alignSelf: 'center', maxWidth: '88%', paddingVertical: 12, paddingHorizontal: 18, backgroundColor: c.notice, borderRadius: 14, borderWidth: 1, borderColor: c.noticeBorder}}><Text style={{fontSize: 13, lineHeight: 20, color: w.error ? c.noticeError : c.text}}>{w.error ?? w.notice}</Text></Pressable>}
  </SafeAreaView>}</ChatDrawer>
    {settingsOpen && <SettingsPreview onClose={() => setSettingsOpen(false)}/>}
  </>;
}
