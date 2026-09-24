import {useState, type Dispatch, type SetStateAction} from 'react';
import {ActivityIndicator, Text, View} from 'react-native';
import {themeLabels, useAppearance, type ThemeMode} from '../appearance/AppAppearance';
import {referenceTypography} from '../../layout/metrics';
import {chatDisplayDescriptions, chatDisplayLabels, chatDisplayModes} from '../chat/chatPresentation';
import {RowPressable} from '../../layout/RowPressable';
import {SwipeBackModal} from '../../layout/SwipeBackModal';
import {SettingsChoice, SettingsGroup, SettingsNote, SettingsPage, SettingsRow, SettingsSave, SettingsSheet, panelReference as r, useSettingsScale} from './SettingsLayout';
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
const settingsGroups = [['ai', 'persona', 'prompt'], ['theme', 'language'], ['plugins', 'about']] as const;

/** Appearance, user profile and AI preferences persist locally. */
export function SettingsPreview({onClose, ai, onAiChange, aiReady, aiError, extensions}: {
  onClose: () => void; ai: AiSettingsPreviewState; onAiChange: Dispatch<SetStateAction<AiSettingsPreviewState>>; aiReady: boolean; aiError: string;
  extensions?: SummaryExtensions;
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

  return <SwipeBackModal onClose={onClose}>{close => <>
    <SettingsPage home onBack={close} obscured={page !== null || sheet !== null}>
      <RowPressable testID="settings-profile" accessibilityRole="button" accessibilityLabel="프로필 수정" onPress={() => setSheet('profile')} radius={r.controlRadius * s} style={{alignSelf: 'center', maxWidth: '100%', marginBottom: r.profileBottom * s}} contentStyle={{alignItems: 'center', gap: r.profileGap * s, paddingHorizontal: r.profileInset * s, paddingVertical: r.profilePadding * s}}>
        <UserAvatar testID="settings-user-avatar" image={profile.image} size={r.profileSize * s}/>
        <Text numberOfLines={1} style={{color: p.text, textAlign: 'center', fontSize: 32 * s, lineHeight: 44 * s, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>{profile.name}</Text>
      </RowPressable>
      {settingsGroups.map((group, index) => <SettingsGroup key={index}>
        {group.map(key => <SettingsRow key={key} label={key === 'language' ? sheetTitles[key] : pageTitles[key]} {...(values[key] ? {value: values[key]} : {})} muted={key === 'ai'} onPress={() => key === 'language' ? setSheet(key) : setPage(key)}/>)}
      </SettingsGroup>)}
      <Text style={{marginLeft: 6 * s, marginTop: 34 * s, color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s}}>Promlive 0.1.0</Text>
    </SettingsPage>

    {page === 'ai' && (aiReady ? <AiSettingsPreview key={pageKey} value={ai} onChange={onAiChange} saveError={aiError} onClose={closePage}/> : <SwipeBackModal key={pageKey} onClose={closePage}>{back => <SettingsPage title="AI" titleInHeader onBack={back}><ActivityIndicator color={p.secondary}/></SettingsPage>}</SwipeBackModal>)}
    {page === 'persona' && <PersonaPage key={pageKey} onClose={closePage}/>}
    {page !== null && page !== 'ai' && page !== 'persona' && <SwipeBackModal key={pageKey} onClose={() => {closeSheet(); closePage();}}>{back => <><SettingsPage title={pageTitles[page]} onBack={back} obscured={sheet !== null}>
      {page === 'theme' && <>
        <SettingsRow plain label="화면 색상" value={themeLabels[mode]} onPress={() => setSheet('theme')}/>
        <SettingsRow plain label="대화 표시" value={chatDisplayLabels[chatDisplay]} onPress={() => setSheet('display')}/>
      </>}
      {page === 'prompt' && <PromptEditor value={prompt} onApply={value => {setPrompt(value); back();}}/>}
      {page === 'plugins' && (extensions ? <SummaryExtensionSettings extensions={extensions}/> : <SettingsNote>등록된 플러그인이 없어요.</SettingsNote>)}
      {page === 'about' && <View style={{marginHorizontal: 6 * s, marginTop: 24 * s, gap: 24 * s}}>
        <Text style={{color: p.text, fontSize: referenceTypography.logoFontSize * s, lineHeight: 58 * s, fontWeight: referenceTypography.logoWeight, letterSpacing: -s}}>Promlive</Text>
        <Text style={{color: p.secondary, fontSize: 26 * s, lineHeight: 38 * s}}>이야기가 시작되는 대화.</Text>
        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: r.rowHeight * s}}><Text style={{color: p.text, fontSize: r.rowFont * s}}>앱 버전</Text><Text style={{color: p.secondary, fontSize: r.valueFont * s}}>0.1.0</Text></View>
      </View>}
    </SettingsPage>{renderSheet()}</>}</SwipeBackModal>}

    {page === null && renderSheet()}
  </>}</SwipeBackModal>;
}

function SettingsField({label, value, onChange, placeholder, multiline = false, maxLength = 100}: {label: string; value: string; onChange: (value: string) => void; placeholder: string; multiline?: boolean; maxLength?: number}) {
  const s = useSettingsScale();
  return <View style={{marginTop: 24 * s}}><SettingsTextField label={label} value={value} onChange={onChange} placeholder={placeholder} multiline={multiline} maxLength={maxLength} autoCapitalize="sentences"/></View>;
}

function PromptEditor({value, onApply}: {value: string; onApply: (value: string) => void}) {
  const [prompt, setPrompt] = useState(value);
  return <>
    <SettingsField label="기본 프롬프트" value={prompt} onChange={setPrompt} placeholder="원하는 응답 방식과 말투를 적어보세요" multiline maxLength={4000}/>
    <SettingsSave onPress={() => onApply(prompt.trim())}/>
  </>;
}
