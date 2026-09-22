import {useEffect, useMemo, useState, useSyncExternalStore} from 'react';
import {ActivityIndicator, Keyboard, Text, View, useWindowDimensions} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardMotionProvider} from './src/layout/KeyboardMotion';
import {initialStartupTheme, useStartupScreen} from './src/layout/StartupScreen';
import {initialize} from './src/app/runtime';
import {Workspace} from './src/app/workspace';
import {WorkspaceChat} from './src/app/WorkspaceChat';
import {NotificationToast} from './src/app/NotificationToast';
import {ChatDrawer} from './src/features/chat/ChatDrawer';
import {ChatHeader} from './src/features/chat/ChatHeader';
import {chatDisplaySettingKey, storedChatDisplay, type ChatDisplayMode} from './src/features/chat/chatPresentation';
import {SettingsPreview} from './src/features/settings/SettingsPreview';
import {AiCatalogCache} from './src/features/settings/aiCatalogCache';
import {AiCatalogContext} from './src/features/settings/AiCatalogContext';
import {AiSettingsPreferences} from './src/features/settings/aiSettingsPreferences';
import {credentialStore} from './src/adapters/credentials/store';
import {AppearanceProvider, storedTheme, themeSettingKey, useAppearance, type ThemeMode} from './src/features/appearance/AppAppearance';

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<ThemeMode>(initialStartupTheme);
  const [chatDisplay, setChatDisplay] = useState<ChatDisplayMode>('default');
  useStartupScreen(!!error, theme);
  useEffect(() => {
    let active = true;
    void initialize().then(async runtime => {
      const next = new Workspace(runtime);
      await next.readyChat();
      const [savedTheme, savedChatDisplay] = await Promise.all([runtime.repo.getSetting(themeSettingKey), runtime.repo.getSetting(chatDisplaySettingKey)]);
      if (active) {setTheme(storedTheme(savedTheme)); setChatDisplay(storedChatDisplay(savedChatDisplay)); setWorkspace(next);}
    }).catch(e => {if (active) setError(e instanceof Error ? e.message : '저장소를 열지 못했어요.');});
    return () => {active = false;};
  }, []);
  const changeTheme = (mode: ThemeMode) => {
    setTheme(mode);
    if (workspace) void workspace.runtime.repo.setSetting(themeSettingKey, mode).catch(e => workspace.notifications.report(e));
  };
  const changeChatDisplay = (mode: ChatDisplayMode) => {
    setChatDisplay(mode);
    if (workspace) void workspace.runtime.repo.setSetting(chatDisplaySettingKey, mode).catch(e => workspace.notifications.report(e));
  };
  return <SafeAreaProvider style={{flex: 1}}><AppearanceProvider mode={theme} setMode={changeTheme} chatDisplay={chatDisplay} setChatDisplay={changeChatDisplay}>
    <KeyboardMotionProvider><AppContent workspace={workspace} error={error}/></KeyboardMotionProvider>
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
  useSyncExternalStore(w.subscribe, w.snapshot);
  useSyncExternalStore(w.history.subscribe, w.history.snapshot);
  const catalogCache = useMemo(() => new AiCatalogCache(w.runtime.repo), [w.runtime.repo]);
  useEffect(() => {void catalogCache.load();}, [catalogCache]);
  const aiPreferences = useMemo(() => w.runtime.aiPreferences ?? new AiSettingsPreferences(w.runtime.repo, credentialStore), [w.runtime]);
  const ai = useSyncExternalStore(aiPreferences.subscribe, aiPreferences.snapshot);
  useEffect(() => {void aiPreferences.load();}, [aiPreferences]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = () => {Keyboard.dismiss(); setSettingsOpen(true);};
  const {width} = useWindowDimensions();
  return <><ChatDrawer cardItems={w.cards} cardActions={w.cardActions} historyList={w.history} startChat={card => card ? w.startChat(card, true) : w.newGeneralChat()} openConversation={item => w.openConversation(item)} report={w.notifications.report} openSettings={openSettings} active={!settingsOpen}>{openHistory => <View style={{flex: 1}}>
    <WorkspaceChat key={w.history.selected?.id ?? 'new'} workspace={w} width={width} header={<ChatHeader width={width} title={w.history.selected?.title ?? '새로운 대화'} conversationId={w.history.selected?.id ?? 'new'} openHistory={openHistory} openSettings={openSettings}/>}/>
    <NotificationToast notifications={w.notifications} width={width}/>
  </View>}</ChatDrawer>
    {settingsOpen && <AiCatalogContext.Provider value={catalogCache}><SettingsPreview ai={ai.value} onAiChange={aiPreferences.update} aiReady={ai.ready} aiError={ai.error} {...(w.runtime.extensions ? {extensions: w.runtime.extensions} : {})} onClose={() => setSettingsOpen(false)}/></AiCatalogContext.Provider>}
  </>;
}
