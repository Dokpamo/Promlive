import {useEffect, useMemo, useState, useSyncExternalStore} from 'react';
import {ActivityIndicator, Keyboard, Text, View, useWindowDimensions} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardMotionProvider} from './src/layout/KeyboardMotion';
import {initialStartupTheme, syncStartupTheme, useStartupScreen} from './src/layout/StartupScreen';
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
import {UserProfilePreferences} from './src/features/profile/userProfile';
import {UserProfileProvider} from './src/features/profile/UserProfileContext';
import {PersonaPreferences} from './src/features/personas/personaPreferences';
import {PersonaProvider} from './src/features/personas/PersonaContext';
import {CardAssetsProvider} from './src/features/cards/CardAssets';
import {CardCreateChoice} from './src/features/cards/CardCreateChoice';
import {StartChoice} from './src/features/cards/SceneControls';
import type {Card} from './src/features/cards/model';
import {CardStudioScreen} from './src/features/authoring/CardStudioScreen';
import {StudioPocket} from './src/features/authoring/StudioPocket';
import type {StudioPreview} from './src/features/authoring/StudioPreview';
import {ConversationPocket, PocketSurface} from './src/features/cards/CardPocketScreen';
import {EditorScreen} from './src/features/cards/EditorScreen';
import {SwipeBackModal} from './src/layout/SwipeBackModal';
import {HeaderButton, ScreenHeader} from './src/layout/ScreenHeader';
import {SafeAreaView} from 'react-native-safe-area-context';

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
      if (active) {
        const restoredTheme = storedTheme(savedTheme);
        syncStartupTheme(restoredTheme);
        setTheme(restoredTheme); setChatDisplay(storedChatDisplay(savedChatDisplay)); setWorkspace(next);
      }
    }).catch(e => {if (active) setError(e instanceof Error ? e.message : '저장소를 열지 못했어요.');});
    return () => {active = false;};
  }, []);
  const changeTheme = (mode: ThemeMode) => {
    syncStartupTheme(mode);
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
  const profile = useMemo(() => new UserProfilePreferences(w.runtime.repo), [w.runtime.repo]);
  const personas = useMemo(() => new PersonaPreferences(w.runtime.repo), [w.runtime.repo]);
  const catalogCache = useMemo(() => new AiCatalogCache(w.runtime.repo), [w.runtime.repo]);
  useEffect(() => {void catalogCache.load();}, [catalogCache]);
  const aiPreferences = useMemo(() => w.runtime.aiPreferences ?? new AiSettingsPreferences(w.runtime.repo, credentialStore), [w.runtime]);
  const ai = useSyncExternalStore(aiPreferences.subscribe, aiPreferences.snapshot);
  useEffect(() => {void aiPreferences.load();}, [aiPreferences]);
  const [createOpen, setCreateOpen] = useState(false);
  const [startingCard, setStartingCard] = useState<Card | null>(null);
  const studioOpen = w.page === 'editor' && !!w.studio;
  const [studioPreview, setStudioPreview] = useState<StudioPreview | null>(null);
  const startCard = async (card?: Card) => {
    if (!card) {await w.newGeneralChat(); return;}
    if ((card.experience?.starts.length ?? 0) > 1) setStartingCard(card); else await w.startChat(card, true);
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = () => {Keyboard.dismiss(); setSettingsOpen(true);};
  const {width} = useWindowDimensions();
  const {settings: p} = useAppearance();
  const settings = settingsOpen && <AiCatalogContext.Provider value={catalogCache}><SettingsPreview ai={ai.value} onAiChange={aiPreferences.update} aiReady={ai.ready} aiError={ai.error} {...(w.runtime.extensions ? {extensions: w.runtime.extensions} : {})} onClose={() => setSettingsOpen(false)}/></AiCatalogContext.Provider>;
  return <UserProfileProvider store={profile}><PersonaProvider store={personas}><CardAssetsProvider store={w.runtime.authoring}><ChatDrawer cardItems={w.cards} cardActions={{...w.cardActions, create: async () => setCreateOpen(true)}} historyList={w.history} startChat={startCard} openConversation={item => w.openConversation(item)} report={w.notifications.report} openSettings={openSettings} active={!settingsOpen && !createOpen && !startingCard && (w.page !== 'editor' || studioOpen)} studioOpen={studioOpen} studioId={studioOpen ? w.studio?.cardId : undefined}
    pocketContent={close => studioOpen && w.studio ? studioPreview ? <ConversationPocket key={studioPreview.session.conversationId} store={studioPreview.store} roomId={studioPreview.session.conversationId} close={close}/> : <StudioPocket session={w.studio} close={close}/> : w.history.selected ? <ConversationPocket key={w.history.selected.id} store={w.runtime.repo} roomId={w.history.selected.id} close={close}/> : <PocketSurface card={null} close={close}/>}>
    {(openHistory, navigation) => <View style={{flex: 1}}>
    {studioOpen && w.studio ? <CardStudioScreen key={w.studio.cardId} session={w.studio} onClose={() => w.closeStudio()} onPublished={() => w.studioPublished()}
      startChat={async (card, startId) => {await w.closeStudio(); await w.startChat(card, true, startId);}} openSettings={openSettings} settings={settings} openCards={openHistory} openPocket={navigation.openPocket} navigationBack={navigation.back} onPreviewChange={setStudioPreview}
      useVersion={w.history.selected?.cardId === w.studio.cardId ? card => w.useStudioVersion(card) : undefined}/> : <WorkspaceChat key={w.history.selected?.id ?? 'new'} workspace={w} width={width} header={<ChatHeader width={width} title={w.history.selected?.title ?? '새로운 대화'} conversationId={w.history.selected?.id ?? 'new'} openHistory={openHistory} openSettings={openSettings}/>}/>}

    <NotificationToast notifications={w.notifications} width={width}/>
  </View>}</ChatDrawer>
    {w.page === 'editor' && !w.studio && <SwipeBackModal onClose={() => void w.go('chat').catch(w.notifications.report)}>{close => <SafeAreaView style={{flex: 1, backgroundColor: p.background}}>
      <ScreenHeader width={width}><HeaderButton width={width} icon="back" label="카드 편집 닫기" onPress={close}/></ScreenHeader>
      <EditorScreen session={w.cardEditor} creation={w.runtime.creation} width={width} startChat={card => w.startChat(card)} duplicate={card => w.duplicate(card)} archive={card => w.archive(card)} openSettings={async () => openSettings()} report={w.notifications.report}/>
      {settings}
    </SafeAreaView>}</SwipeBackModal>}
    {w.page !== 'editor' && settings}
    {createOpen && <CardCreateChoice onClose={() => setCreateOpen(false)} create={() => w.createStudio()} importCard={text => w.importStudio(text)} report={w.notifications.report}/>}
    {startingCard && <StartChoice card={startingCard} onClose={() => setStartingCard(null)} onChoose={id => {void w.startChat(startingCard, true, id).catch(w.notifications.report);}}/>}
  </CardAssetsProvider></PersonaProvider></UserProfileProvider>;
}
