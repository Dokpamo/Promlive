import {screenCommands} from '../workspace/commands';
import {StorageIssueBanner} from '../StorageIssueBanner';
import {useCallback, useEffect, useMemo, useState, useSyncExternalStore} from 'react';
import {Animated, Keyboard, Platform, Text, View, useWindowDimensions} from 'react-native';
import {tabs, type Tab} from '../Navigation';
import {TabButton} from '../TabButton';
import {Icon} from '../Icon';
import {useReducedMotion} from '../useReducedMotion';
import {usePalette} from '../Theme';
import type {ScreenMemoryController as ScreenMemory} from '../ScreenController';
import {useScreenMemory} from '../useScreenMemory';
import {publishedLibraryCards} from '../cardWorkspace';
import {CardEditor} from '../CardEditor';
import {ChatRoom} from '../ChatRoom';
import {ImageViewer} from '../ImageViewer';
import {Settings} from '../Settings';
import {SettingsNavigator} from '../settings/SettingsNavigator';
import type {SettingsDestination} from '../settings/OtherSettings';
import {createBackTransition} from '../backTransition';
import {DesktopPane} from './DesktopPane';
import {HoverPressable} from './DesktopFeedback';
import {DesktopSearchDismissal} from './DesktopSearchDismissal';
import {desktopMetrics} from './desktopMetrics';
import {desktopActiveTab, desktopLayout, desktopRailWidth, desktopTabView} from './desktopLayout';
import {DesktopCardDetail, DesktopCardPreview, DesktopChats, DesktopCreation, DesktopEmpty, DesktopHeader, DesktopLibrary, desktopScale as scale} from './DesktopPages';

/** Desktop navigation stays outside every detail route and independently scrolling pane. */
export function DesktopShell({memory}: {memory: ScreenMemory}) {
  const colors = usePalette(), window = useWindowDimensions(), reducedMotion = useReducedMotion();
  const [frame, setFrame] = useState({width: window.width, height: window.height});
  const width = frame.width, height = frame.height, layout = desktopLayout(width);
  const {data, view, saveError, storageIssue} = useSyncExternalStore(memory.subscribe, memory.getSnapshot);
  useScreenMemory(memory);
  const tab = desktopActiveTab(view);
  const library = useMemo(() => publishedLibraryCards(data.cards), [data.cards]);
  const card = data.cards.find(item => item.id === view.openedCardId);
  const detail = library.find(item => item.id === view.detailCardId);
  const chat = data.chats.find(item => item.id === view.chatId);
  const [settingsDetail, setSettingsDetail] = useState<SettingsDestination | null>(null);
  const commands = useMemo(() => screenCommands(memory), [memory]);
  const transition = useMemo(() => createBackTransition(new Animated.Value(0), layout.content,
    {topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0}), [layout.content]);
  const changeTab = useCallback((next: Tab) => {
    Keyboard.dismiss(); memory.updateView(current => desktopTabView(current, next));
  }, [memory]);
  const search = commands.search;
  const openEditor = (id: string) => {
    memory.resetScroll('editor');
    memory.updateView(current => ({...current, tab: 'create', openedCardId: id, detailCardId: null, chatId: null, coverOpen: false, galleryIndex: null}));
  };
  const closeEditor = () => memory.updateView(current => ({...current, openedCardId: null}));
  const closeDetail = () => memory.updateView(current => ({...current, detailCardId: null, coverOpen: false, galleryIndex: null}));
  const closeChat = () => memory.updateView(current => ({...current, chatId: null}));
  const closeImage = () => memory.updateView(current => ({...current, coverOpen: false, galleryIndex: null}));
  const openChat = (id: string) => memory.updateView(current => ({...current, tab: 'chats', chatId: id, detailCardId: null, openedCardId: null, coverOpen: false, galleryIndex: null}));
  const createCard = () => {
    openEditor(commands.createCard());
  };
  useEffect(() => {
    if (Platform.OS !== 'web' || tab === 'settings') return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (view.coverOpen) closeImage(); else if (card) closeEditor(); else if (detail) closeDetail(); else if (chat) closeChat();
      else return;
      event.preventDefault();
    };
    document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape);
  });
  const chatListWidth = layout.split ? layout.chatList : layout.content;
  const roomWidth = Math.min(800, layout.content - (layout.split ? chatListWidth + 1 : 0));
  const settingsWidth = layout.content - (layout.split ? layout.settingsList + 1 : 0);
  const editorWidth = Math.min(760, layout.content - layout.preview);
  return <DesktopSearchDismissal testID="ui-desktop-shell" onLayout={event => {const {width: w, height: h} = event.nativeEvent.layout;
    if (w > 0 && h > 0) setFrame(old => old.width === w && old.height === h ? old : {width: w, height: h});}}
    style={{flex: 1, minWidth: 0, minHeight: 0, backgroundColor: colors.background}}>
    <View style={{flex: 1, minHeight: 0, flexDirection: 'row'}}>
      <View testID="ui-desktop-rail" accessibilityRole="tablist" style={{width: desktopRailWidth, flexShrink: 0, borderRightWidth: 1, borderRightColor: colors.separator, alignItems: 'center', paddingTop: 16, paddingBottom: 16, gap: 10}}>
        <Text accessible={false} style={{height: 42, fontSize: 22, fontWeight: '800', color: colors.foreground, paddingTop: 4}}>P</Text>
        {tabs.map(item => <View key={item} style={{width: 42, height: 42, borderRadius: 12, backgroundColor: tab === item ? colors.surface : 'transparent'}}>
          <TabButton name={item} selected={item === tab} size={desktopMetrics.icon} reducedMotion={reducedMotion} onChange={changeTab} desktop/>
        </View>)}
        <View style={{flex: 1}}/>
        <HoverPressable desktop testID="ui-desktop-profile" accessibilityRole="button" accessibilityLabel="프로필 편집" onPress={() => {changeTab('settings'); setSettingsDetail('profile');}}
          style={{width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center'}}><Icon name="user" size={22}/></HoverPressable>
      </View>
      <DesktopPane width={layout.content} height={height} testID="ui-desktop-content">
        {tab === 'library' && (detail ? <>
          <View style={{flex: 1}} accessibilityElementsHidden={view.coverOpen} aria-hidden={view.coverOpen} pointerEvents={view.coverOpen ? 'none' : 'auto'}>
            <DesktopCardDetail card={detail} width={layout.content} memory={memory} onClose={closeDetail} onEdit={() => openEditor(detail.id)}
              onImage={index => memory.updateView(current => ({...current, coverOpen: true, galleryIndex: index ?? null}))}
              onChat={() => {memory.ensureChat(detail); openChat(detail.id);}}/>
          </View>
          {view.coverOpen && <View style={{position: 'absolute', inset: 0}}><ImageViewer card={detail} width={layout.content} scale={scale} transition={transition}
            galleryIndex={view.galleryIndex} onClose={closeImage} onSelectImage={galleryIndex => memory.updateView(current => ({...current, galleryIndex}))}/></View>}
        </> : <DesktopLibrary items={library} width={layout.content} columns={layout.columns} memory={memory} view={view} search={search}
          onOpen={id => {memory.resetScroll('detail'); memory.updateView(current => ({...current, detailCardId: id}));}}/>)}
        {tab === 'chats' && <View style={{flex: 1, minHeight: 0, flexDirection: 'row'}}>
          {(layout.split || !chat) && <View testID="ui-desktop-chat-list-pane" style={{width: chatListWidth, minHeight: 0}}>
            <DesktopChats chats={data.chats} memory={memory} view={view} search={search} onOpen={openChat} compact={layout.split}/></View>}
          {layout.split && <View style={{width: 1, backgroundColor: colors.separator}}/>}
          {(layout.split || chat) && <View testID="ui-desktop-chat-detail-pane" style={{flex: 1, minWidth: 0, alignItems: 'center'}}>
            {chat ? <DesktopPane width={roomWidth} height={height}><ChatRoom key={chat.id} chat={chat} memory={memory} scale={scale} transition={transition} onClose={closeChat}
              gallery={data.cards.find(item => item.id === chat.id)?.published?.gallery ?? [{id: 'cover', tile: chat.tile, title: chat.title}]}/></DesktopPane>
              : <DesktopEmpty>대화를 선택해 이어서 이야기해 보세요.</DesktopEmpty>}
          </View>}
        </View>}
        {tab === 'create' && (card ? <View style={{flex: 1, minHeight: 0, flexDirection: 'row'}}>
          <View style={{flex: 1, minWidth: 0, alignItems: 'center'}}><DesktopPane width={editorWidth} height={height}>
            <CardEditor key={card.id} card={card} memory={memory} scale={scale} topInset={0} bottomInset={0} backTransition={transition} onClose={closeEditor}
              onChange={(field, value) => commands.editCard(card.id, field, value)}
              onGalleryChange={images => commands.setGallery(card.id, images)}
              onComplete={() => {commands.completeCard(card.id); closeEditor();}}/>
          </DesktopPane></View>
          {layout.preview > 0 && <DesktopCardPreview content={card.draft} width={layout.preview}/>}
        </View> : <DesktopCreation key={view.creationFilter} cards={data.cards} memory={memory} view={view} search={search} onOpen={openEditor} onCreate={createCard}/>)}
        {tab === 'settings' && <View style={{flex: 1, minHeight: 0, flexDirection: 'row'}}>
          {(layout.split || !settingsDetail) && <View testID="ui-desktop-settings-list-pane" style={{width: layout.split ? layout.settingsList : layout.content}}>
            <DesktopHeader tab="settings"/><Settings memory={memory} scale={scale} selected={settingsDetail} compact={layout.split} onOpen={setSettingsDetail}/>
          </View>}
          {layout.split && <View style={{width: 1, backgroundColor: colors.separator}}/>}
          {(layout.split || settingsDetail) && <View testID="ui-desktop-settings-detail-pane" style={{flex: 1, minWidth: 0, alignItems: 'center'}}>
            {settingsDetail ? <DesktopPane width={settingsWidth} height={height}><SettingsNavigator key={settingsDetail} initial={settingsDetail} transition={transition} scale={scale} bottomInset={0} onClose={() => setSettingsDetail(null)}/></DesktopPane>
              : <DesktopEmpty>변경할 설정을 선택해 주세요.</DesktopEmpty>}
          </View>}
        </View>}
      </DesktopPane>
    </View>
    {saveError && <StorageIssueBanner memory={memory} issue={storageIssue}/>}
  </DesktopSearchDismissal>;
}
