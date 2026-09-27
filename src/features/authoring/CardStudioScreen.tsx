import {useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode} from 'react';
import {AppState, BackHandler, Keyboard, Platform, ScrollView, Text, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {KeyboardMotionProvider, useKeyboardFrame} from '../../layout/KeyboardMotion';
import {ScreenHeader, HeaderButton, HeaderCapsule} from '../../layout/ScreenHeader';
import {headerScale, referenceHeader} from '../../layout/metrics';
import {referenceMessage, composerScale} from '../chat/chatAppearance';
import {useAppearance} from '../appearance/AppAppearance';
import {SettingsTextEditorHost, useTextEditorCovered} from '../settings/SettingsTextField';
import {SettingsSheet, SettingsChoice} from '../settings/SettingsLayout';
import {ChatComposer} from '../chat/ChatComposer';
import {ChatScreen} from '../chat/ChatScreen';
import type {Card} from '../cards/model';
import {StartChoice} from '../cards/SceneControls';
import type {AuthoringSession} from './AuthoringSession';
import {fieldLabel, type AuthoringProject} from './model';
import {StudioEditor} from './StudioEditor';
import {StudioAction} from './StudioControls';
import {StudioConversation} from './StudioConversation';
import {StudioPreview} from './StudioPreview';
import {exportCardBundle} from './cardBundle';
import {saveCardFile} from '../../adapters/files/cardFiles';

interface Props {
  session: AuthoringSession; onClose: () => Promise<void>;
  onPublished: () => Promise<void>; startChat: (card: Card, startId?: string) => Promise<void>;
  useVersion?: ((card: Card) => Promise<void>) | undefined;
  openSettings: () => void; settings?: ReactNode;
  openCards?: () => void; openPocket?: (() => void) | undefined; navigationBack?: () => boolean;
  onPreviewChange?: (preview: StudioPreview | null) => void;
}

/** The maker occupies the chat canvas; input editors remain our existing overlays. */
export function CardStudioScreen(props: Props) {
  const closing = useRef(false);
  const [error, setError] = useState('');
  const requestClose = useCallback(() => {
    if (closing.current || props.session.snapshot().publishing) return true;
    closing.current = true; props.session.cancel();
    void props.session.flush().then(async () => {Keyboard.dismiss(); await props.onClose();}).catch(error => {
      closing.current = false; setError(error instanceof Error ? error.message : '초안을 저장하지 못했어요.');
    });
    return true;
  }, [props.session, props.onClose]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {if (state !== 'active') void props.session.flush().catch(() => {});});
    const back = Platform.OS === 'android' ? BackHandler.addEventListener('hardwareBackPress', () => {
      if (props.navigationBack?.()) return true;
      if (props.session.snapshot().project?.view !== 'ai') {props.session.setView('ai'); return true;} return requestClose();
    }) : undefined;
    return () => {subscription.remove(); back?.remove();};
  }, [props.session, props.navigationBack, requestClose]);
  return <KeyboardMotionProvider><SettingsTextEditorHost><StudioContent {...props} close={requestClose} closeError={error}/></SettingsTextEditorHost></KeyboardMotionProvider>;
}

function StudioContent({session, onPublished, startChat, useVersion, openSettings, settings, close, closeError, openCards, openPocket, onPreviewChange}: Props & {close: () => void; closeError: string}) {
  const state = useSyncExternalStore(session.subscribe, session.snapshot);
  const {colors: c, settings: p} = useAppearance();
  const {width} = useWindowDimensions();
  const s = headerScale(width), chatScale = composerScale(width), insets = useSafeAreaInsets(), keyboard = useKeyboardFrame();
  const [notice, setNotice] = useState('');
  const [composerHeight, setComposerHeight] = useState(112 * s + insets.bottom);
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<StudioPreview | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewStart, setPreviewStart] = useState<string | undefined>();
  const [chooseStart, setChooseStart] = useState<'preview' | 'chat' | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportAction = useRef<(() => void) | null>(null);
  const [exporting, setExporting] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const nearBottom = useRef(true);
  const covered = useTextEditorCovered();
  const report = (error: unknown) => setNotice(error instanceof Error ? error.message : '작업을 마치지 못했어요.');
  const project = state.project;
  useEffect(() => {
    if (project?.view !== 'preview') {setPreview(null); onPreviewChange?.(null); return;}
    const next = new StudioPreview(project.draft, project.revision, session.assistant.coordinator, error => {if (error) setNotice(error instanceof Error ? error.message : '대화 시험에 실패했어요.');}, previewStart);
    setPreview(next); onPreviewChange?.(next); return () => {next.dispose(); onPreviewChange?.(null);};
    // Capture the draft on entry/restart, never mutate a running test with editor changes.
  }, [project?.view, previewKey, previewStart, session, onPreviewChange]);
  if (!project) return null;
  const chooseView = (view: AuthoringProject['view']) => {Keyboard.dismiss(); setNotice(''); session.setView(view); scroller.current?.scrollTo({y: 0, animated: false});};
  const launch = (mode: 'preview' | 'chat', startId?: string) => {
    if (mode === 'preview') {setPreviewStart(startId); chooseView('preview');}
    else void startChat(project.draft, startId).catch(report);
  };
  const requestStart = (mode: 'preview' | 'chat') => {
    if ((project.draft.experience?.starts.length ?? 0) > 1) {Keyboard.dismiss(); setChooseStart(mode);} else launch(mode);
  };
  const publish = async () => {
    try {await session.publish(); await onPublished(); chooseView('edit'); setNotice('카드를 완성했어요. 새 대화로 시작하거나 파일로 공유할 수 있어요.');}
    catch (error) {report(error);}
  };
  const exportFile = async (share: boolean) => {
    if (exporting) return; setExporting(true);
    try {await session.flush(); const file = await exportCardBundle(project.draft, session.store); await saveCardFile(file.filename, file.contents, share);}
    catch (error) {report(error);} finally {setExporting(false);}
  };
  const error = closeError || state.error || notice;
  const currentPublished = project.publishedDraftRevision === project.revision;
  if (project.view === 'preview' && preview) return <View testID="card-studio-preview" style={{flex: 1, backgroundColor: c.background}}>
    <ChatScreen key={preview.session.conversationId} session={preview.session} repo={preview.store} sceneStore={preview.store} creation={preview.creation} width={width} report={report} inform={setNotice}
      header={<ScreenHeader width={width} topInset={insets.top}>
        <HeaderButton width={width} icon="back" label="제작으로 돌아가기" onPress={() => chooseView('edit')}/>
        <View style={{flex: 1, height: referenceHeader.height * s, justifyContent: 'center', alignItems: 'center'}}><Text style={{color: c.text, fontSize: 28 * s}}>대화 시험</Text></View>
        <HeaderButton width={width} icon="reset" label="현재 초안으로 대화 시험 다시 시작" onPress={() => setPreviewKey(value => value + 1)}/>
      </ScreenHeader>}/>
    {!!error && <View pointerEvents="none" style={{position: 'absolute', top: insets.top + 100 * s, left: 30 * s, right: 30 * s, padding: 18 * s, backgroundColor: p.surface, borderRadius: 22 * s}}><Text style={{color: p.text, fontSize: 22 * s}}>{error}</Text></View>}
  </View>;
  const ai = project.view === 'ai';
  return <View testID="card-studio" style={{flex: 1, backgroundColor: c.background}}>
    <ScrollView ref={scroller} testID="studio-scroll" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never"
      onScroll={event => {const v = event.nativeEvent; nearBottom.current = v.contentSize.height - v.layoutMeasurement.height - v.contentOffset.y < 130;}} scrollEventThrottle={16}
      onContentSizeChange={() => {if (ai && nearBottom.current && project.messages.length) scroller.current?.scrollToEnd({animated: true});}}
      pointerEvents={expanded ? 'none' : 'auto'} accessibilityElementsHidden={expanded} importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'}
      contentContainerStyle={{maxWidth: 800, width: '100%', alignSelf: 'center', paddingHorizontal: referenceMessage.inset * chatScale,
        paddingTop: insets.top + referenceHeader.barHeight * s + referenceMessage.top * chatScale,
        paddingBottom: ai ? composerHeight + Math.max(0, keyboard.height - insets.bottom) + 24 * s : insets.bottom + 36 * s}}>
      {!!error && <View accessibilityLiveRegion="polite" style={{paddingVertical: 20 * s, marginBottom: 20 * s, gap: 12 * s}}>
        <Text style={{color: c.text, fontSize: 23 * s, lineHeight: 34 * s}}>{error}</Text>
        {state.error && state.saving && <StudioAction label="저장 다시 시도" scale={s} onPress={() => void session.flush().catch(report)}/>}
      </View>}
      {!ai && <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12 * s, marginBottom: 22 * s}}>
        <StudioAction label="대화 시험" scale={s} onPress={() => requestStart('preview')}/>
        {openPocket && <StudioAction label="포켓 상태창" scale={s} onPress={openPocket}/>}
        {currentPublished && <><StudioAction label="새 대화 시작" scale={s} onPress={() => requestStart('chat')}/><StudioAction label="파일로 내보내기" scale={s} disabled={exporting} onPress={() => setExportOpen(true)}/></>}
        {currentPublished && useVersion && <StudioAction label="현재 대화에도 반영" scale={s} onPress={() => void useVersion(project.draft).then(() => setNotice('다음 응답부터 수정한 설정을 사용해요.')).catch(report)}/>}
      </View>}
      {ai && project.target && <View style={{alignSelf: 'flex-start', marginBottom: 20 * s}}><StudioAction label={`${fieldLabel(project.target)}만 수정 · 전체로 전환`} scale={s} onPress={() => session.setTarget(null)}/></View>}
      {ai ? <StudioConversation session={session} project={project} scale={chatScale} report={report} openSettings={openSettings} openPocket={openPocket} saving={state.saving}/> : <StudioEditor session={session} project={project} scale={s} report={report} disabled={state.publishing}/>}
    </ScrollView>
    <View pointerEvents={expanded ? 'none' : 'box-none'} accessibilityElementsHidden={expanded} style={{position: 'absolute', left: 0, right: 0, top: insets.top}}>
      <ScreenHeader width={width} topInset={insets.top}>
        <HeaderButton testID="studio-close" width={width} icon="back" label={ai ? openCards ? '카드 목록 열기' : '제작 닫기' : 'AI와 만들기'} onPress={ai ? openCards ?? close : () => chooseView('ai')}/>
        <View style={{flex: 1, height: referenceHeader.height * s, justifyContent: 'center', alignItems: 'center'}}>
          <Text accessibilityRole="header" numberOfLines={1} style={{color: c.text, fontSize: 28 * s, lineHeight: 36 * s}}>{ai ? '카드 제작' : '구성 편집'}</Text>
          <Text testID="studio-save-status" style={{color: c.muted, fontSize: 17 * s}}>{state.error && state.saving ? '저장 확인 필요' : state.publishing ? '완성하는 중…' : state.saving ? '저장 중…' : currentPublished ? '완성됨' : '초안 자동 저장'}</Text>
        </View>
        <HeaderCapsule width={width} style={{flexDirection: 'row'}}>
          <HeaderButton testID={ai ? 'studio-tab-edit' : 'studio-tab-ai'} width={width} variant="grouped" icon={ai ? 'settings' : 'chat'} label={ai ? '직접 편집' : 'AI와 만들기'} onPress={() => chooseView(ai ? 'edit' : 'ai')}/>
          <HeaderButton testID="studio-publish" width={width} icon="check" variant="grouped" label="카드로 사용" disabled={state.generating || state.publishing || !project.draft.title.trim()} onPress={() => void publish()}/>
        </HeaderCapsule>
      </ScreenHeader>
    </View>
    {ai && <View pointerEvents={covered ? 'none' : 'box-none'} style={{position: 'absolute', inset: 0}}>
      <ChatComposer value={project.prompt} onChange={session.setPrompt} onSend={() => {nearBottom.current = true; void session.generate(); scroller.current?.scrollToEnd({animated: true});}} onCancel={session.cancel} onHint={setNotice}
        width={width} bottom={insets.bottom} ready={!state.publishing} onHeight={setComposerHeight} onExpandedChange={setExpanded}
        action={{kind: state.generating ? 'cancel' : 'send', enabled: state.generating || !!project.prompt.trim() && !state.publishing, label: state.generating ? '제작 중단' : 'AI에 제작 요청'}}/>
    </View>}
    {chooseStart && <StartChoice card={project.draft} onClose={() => setChooseStart(null)} onChoose={id => launch(chooseStart, id)}/>}
    {exportOpen && <SettingsSheet title="카드 파일" onClose={() => {setExportOpen(false); const action = exportAction.current; exportAction.current = null; action?.();}}>{close => <>
      <SettingsChoice label="파일로 저장" detail=".promcard 파일에 프롬프트와 에셋을 함께 담아요." selected={false} onPress={() => {exportAction.current = () => void exportFile(false); close();}}/>
      <SettingsChoice label="공유" selected={false} onPress={() => {exportAction.current = () => void exportFile(true); close();}}/>
    </>}</SettingsSheet>}
    {settings}
  </View>;
}
