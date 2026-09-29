import {useState, type Dispatch, type SetStateAction} from 'react';
import {ActivityIndicator, Text, View} from 'react-native';
import {themeLabels, useAppearance, type ThemeMode} from '../appearance/AppAppearance';
import {referenceTypography} from '../../layout/metrics';
import {chatDisplayDescriptions, chatDisplayLabels, chatDisplayModes} from '../chat/chatPresentation';
import {SwipeBackModal} from '../../layout/SwipeBackModal';
import {SettingsChoice, SettingsMenuRow, SettingsNote, SettingsPage, SettingsRow, SettingsSave, SettingsSheet, panelReference as r, useSettingsScale} from './SettingsLayout';
import type {SettingsIconName} from './SettingsIcon';
import {settingsMenuGeometry} from './SettingsMenuRow';
import {AiSettingsPreview} from './AiSettingsPreview';
import {aiServices, type AiSettingsPreviewState} from './aiSettingsModel';
import {useSettingsSheetState} from './useSettingsSheetState';
import {SettingsTextField} from './SettingsTextField';
import {SummaryExtensionSettings} from '../../extensions/SummaryExtensionSettings';
import type {SummaryExtensions} from '../../extensions/SummaryExtensions';
import {UserAvatar} from '../profile/UserAvatar';
import {useUserProfile} from '../profile/UserProfileContext';
import {ProfileSheet} from '../profile/ProfileSheet';
import {PersonaPage} from '../personas/PersonaPage';
import {usePersonas} from '../personas/PersonaContext';
import {MainHeaderButton} from '../../app/MainTabHeader';

type Page = 'ai' | 'persona' | 'prompt' | 'theme' | 'plugins' | 'about';
type Sheet = 'profile' | 'theme' | 'display' | 'language';
const pageTitles: Record<Page, string> = {ai: 'AI', persona: '페르소나', prompt: '프롬프트', theme: '테마', plugins: '플러그인', about: '정보'};
const sheetTitles: Record<Exclude<Sheet, 'profile'>, string> = {theme: '화면 색상', display: '대화 표시', language: '언어'};
const sheetCaptions: Partial<Record<Sheet, string>> = {
  theme: '편안하게 사용할 화면 테마를 선택해요.',
  display: '같은 대화를 원하는 모습으로 읽어보세요.',
  language: '앱에서 사용할 언어를 선택해요.',
};
// Keep this order fixed. Usage frequency never rearranges the settings.
const settingsMenu = [
  {key: 'ai', icon: 'model'}, {key: 'persona', icon: 'person'}, {key: 'prompt', icon: 'response'},
  {key: 'theme', icon: 'theme'}, {key: 'language', icon: 'language'}, {key: 'plugins', icon: 'connection'}, {key: 'about', icon: 'info'},
] as const satisfies readonly {key: Page | 'language'; icon: SettingsIconName}[];

/** Appearance, user profile and AI preferences persist locally. */
export function SettingsPreview({onClose, ai, onAiChange, aiReady, aiError, extensions, embedded = false, active = true}: {
  onClose: () => void; ai: AiSettingsPreviewState; onAiChange: Dispatch<SetStateAction<AiSettingsPreviewState>>; aiReady: boolean; aiError: string;
  extensions?: SummaryExtensions;
  embedded?: boolean;
  active?: boolean;
}) {
  const {settings: p, mode, setMode, chatDisplay, setChatDisplay} = useAppearance();
  const s = useSettingsScale();
  const {sheet: page, sheetKey: pageKey, setSheet: setPage, closeSheet: closePage} = useSettingsSheetState<Page>();
  const {sheet, sheetKey, setSheet, closeSheet} = useSettingsSheetState<Sheet>();
  const {value: profile} = useUserProfile();
  const {value: personas, ready: personasReady} = usePersonas();
  const [language, setLanguage] = useState('한국어');
  const [prompt, setPrompt] = useState('');
  const choose = (setter: (value: string) => void, value: string, close: () => void) => {setter(value); close();};
  const values = {ai: aiServices.find(service => service.id === ai.service)?.name, persona: personasReady ? `${personas.items.length}개` : undefined, prompt: prompt ? '사용자 설정' : '기본', theme: themeLabels[mode], language, plugins: undefined, about: undefined};
  const renderSheet = () => sheet === 'profile' ? <ProfileSheet key={sheetKey} onClose={closeSheet}/> : sheet !== null && <SettingsSheet key={sheetKey} title={sheetTitles[sheet]} {...(sheetCaptions[sheet] ? {caption: sheetCaptions[sheet]} : {})} onClose={closeSheet}>{dismiss => <>
    {sheet === 'theme' && (['light', 'dark', 'system'] satisfies ThemeMode[]).map(value => <SettingsChoice key={value} label={themeLabels[value]} detail={value === 'light' ? '밝고 선명한 화면' : value === 'dark' ? '눈이 편안한 어두운 화면' : '기기의 설정에 맞춰 자동으로'} selected={mode === value} onPress={() => {setMode(value); dismiss();}}/>)}
    {sheet === 'display' && chatDisplayModes.map(value => <SettingsChoice key={value} label={chatDisplayLabels[value]} detail={chatDisplayDescriptions[value]} selected={chatDisplay === value} onPress={() => {setChatDisplay(value); dismiss();}}/>)}
    {sheet === 'language' && ['한국어', 'English', '日本語'].map(value => <SettingsChoice key={value} label={value} selected={language === value} onPress={() => choose(setLanguage, value, dismiss)}/>)}
  </>}</SettingsSheet>;

  const content = (close: () => void) => <>
    <SettingsPage home onBack={close} embedded={embedded} active={active}
      {...(embedded ? {title: '설정', titleInHeader: true, headerRight: <MainHeaderButton testID="settings-profile-edit" icon="compose" label="프로필 편집" onPress={() => setSheet('profile')}/>} : {})}
      obscured={page !== null || sheet !== null}>
      <View testID="settings-menu">
        <View style={{paddingTop: 6 * s, paddingBottom: 28 * s, borderBottomWidth: .5, borderBottomColor: p.divider, marginBottom: 10 * s}}>
          <SettingsMenuRow testID="settings-profile" accessibilityLabel="프로필 수정" label={profile.name} detail="프로필 사진과 이름을 변경해요."
            icon={<UserAvatar testID="settings-user-avatar" image={profile.image} size={64 * s}/>} onPress={() => setSheet('profile')}/>
        </View>
        {settingsMenu.map(({key, icon}) => <SettingsMenuRow key={key} testID={`settings-menu-${icon}`} icon={icon} label={key === 'language' ? sheetTitles[key] : pageTitles[key]}
          {...(values[key] ? {value: values[key]} : {})} onPress={() => key === 'language' ? setSheet(key) : setPage(key)}/>)}
      </View>
    </SettingsPage>

    {page === 'ai' && (aiReady ? <AiSettingsPreview key={pageKey} value={ai} onChange={onAiChange} saveError={aiError} onClose={closePage}/> : <SwipeBackModal key={pageKey} onClose={closePage}>{back => <SettingsPage title="AI" titleInHeader onBack={back}><ActivityIndicator color={p.secondary}/></SettingsPage>}</SwipeBackModal>)}
    {page === 'persona' && <PersonaPage key={pageKey} onClose={closePage}/>}
    {page !== null && page !== 'ai' && page !== 'persona' && <SwipeBackModal key={pageKey} onClose={() => {closeSheet(); closePage();}}>{back => <><SettingsPage title={pageTitles[page]} onBack={back} obscured={sheet !== null}>
      {page === 'theme' && <>
        <SettingsRow icon="theme" label="화면 색상" value={themeLabels[mode]} onPress={() => setSheet('theme')}/>
        <SettingsRow icon="response" label="대화 표시" value={chatDisplayLabels[chatDisplay]} onPress={() => setSheet('display')}/>
      </>}
      {page === 'prompt' && <PromptEditor value={prompt} onApply={value => {setPrompt(value); back();}}/>}
      {page === 'plugins' && (extensions ? <SummaryExtensionSettings extensions={extensions}/> : <SettingsNote inset={settingsMenuGeometry.textInset}>등록된 플러그인이 없어요.</SettingsNote>)}
      {page === 'about' && <View style={{marginLeft: settingsMenuGeometry.textInset * s, marginTop: 16 * s, gap: 24 * s}}>
        <Text style={{color: p.text, fontSize: referenceTypography.logoFontSize * s, lineHeight: 58 * s, fontWeight: referenceTypography.logoWeight, letterSpacing: -s}}>Promlive</Text>
        <Text style={{color: p.secondary, fontSize: 26 * s, lineHeight: 38 * s}}>이야기가 시작되는 대화.</Text>
        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: r.rowHeight * s}}><Text style={{color: p.text, fontSize: r.rowFont * s}}>앱 버전</Text><Text style={{color: p.secondary, fontSize: r.valueFont * s}}>0.1.0</Text></View>
      </View>}
    </SettingsPage>{renderSheet()}</>}</SwipeBackModal>}

    {page === null && renderSheet()}
  </>;
  return embedded ? content(onClose) : <SwipeBackModal onClose={onClose}>{content}</SwipeBackModal>;
}

function SettingsField({label, value, onChange, placeholder, multiline = false, maxLength = 100}: {label: string; value: string; onChange: (value: string) => void; placeholder: string; multiline?: boolean; maxLength?: number}) {
  return <SettingsTextField icon="response" label={label} value={value} onChange={onChange} placeholder={placeholder} multiline={multiline} maxLength={maxLength} autoCapitalize="sentences"/>;
}

function PromptEditor({value, onApply}: {value: string; onApply: (value: string) => void}) {
  const [prompt, setPrompt] = useState(value);
  return <>
    <SettingsField label="기본 프롬프트" value={prompt} onChange={setPrompt} placeholder="원하는 응답 방식과 말투를 적어보세요" multiline maxLength={4000}/>
    <SettingsSave onPress={() => onApply(prompt.trim())}/>
  </>;
}
