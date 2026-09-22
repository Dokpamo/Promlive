import {useState, type Dispatch, type SetStateAction} from 'react';
import {ActivityIndicator, Text, TextInput, View} from 'react-native';
import {themeLabels, useAppearance, type ThemeMode} from '../appearance/AppAppearance';
import {referenceTypography} from '../chat/chatAppearance';
import {chatDisplayDescriptions, chatDisplayLabels, chatDisplayModes} from '../chat/chatPresentation';
import {SettingsIcon} from './SettingsIcon';
import {SettingsPressable} from './SettingsPressable';
import {SwipeBackBoundary, SwipeBackModal} from './SwipeBackModal';
import {SettingsChoice, SettingsGroup, SettingsNote, SettingsPage, SettingsRow, SettingsSave, SettingsSheet, settingsReference as r, useSettingsRadius, useSettingsScale} from './SettingsLayout';
import {AiSettingsPreview} from './AiSettingsPreview';
import {aiServices, type AiSettingsPreviewState} from './aiSettingsModel';
import {useSettingsSheetState} from './useSettingsSheetState';

type Page = 'ai' | 'persona' | 'prompt' | 'theme' | 'plugins' | 'about';
type Sheet = 'profile' | 'theme' | 'display' | 'language';
type Persona = {name: string; description: string};
const pageTitles: Record<Page, string> = {ai: 'AI', persona: '페르소나', prompt: '프롬프트', theme: '테마', plugins: '플러그인', about: '정보'};
const sheetTitles: Record<Sheet, string> = {profile: '내 정보', theme: '화면 색상', display: '대화 표시', language: '언어'};
const sheetCaptions: Partial<Record<Sheet, string>> = {
  theme: '편안하게 사용할 화면 테마를 선택해요.',
  display: '같은 대화를 원하는 모습으로 읽어보세요.',
  language: '앱에서 사용할 언어를 선택해요.',
};
// Keep this order fixed. Usage frequency never rearranges the settings.
const settingsGroups = [['ai', 'persona', 'prompt'], ['theme', 'language'], ['plugins', 'about']] as const;

/** Appearance, AI preferences and separately stored API keys persist; login remains a preview. */
export function SettingsPreview({onClose, ai, onAiChange, aiReady, aiError}: {
  onClose: () => void; ai: AiSettingsPreviewState; onAiChange: Dispatch<SetStateAction<AiSettingsPreviewState>>; aiReady: boolean; aiError: string;
}) {
  const {settings: p, mode, setMode, chatDisplay, setChatDisplay} = useAppearance();
  const s = useSettingsScale();
  const [page, setPage] = useState<Page | null>(null);
  const {sheet, sheetKey, setSheet, closeSheet} = useSettingsSheetState<Sheet>();
  const [name, setName] = useState('사용자');
  const [language, setLanguage] = useState('한국어');
  const [persona, setPersona] = useState<Persona>({name: '기본', description: ''});
  const [prompt, setPrompt] = useState('');
  const choose = (setter: (value: string) => void, value: string, close: () => void) => {setter(value); close();};
  const values = {ai: aiServices.find(service => service.id === ai.service)?.name, persona: persona.name, prompt: prompt ? '사용자 설정' : '기본', theme: themeLabels[mode], language, plugins: undefined, about: undefined};
  const renderSheet = () => sheet !== null && <SettingsSheet key={sheetKey} title={sheetTitles[sheet]} {...(sheetCaptions[sheet] ? {caption: sheetCaptions[sheet]} : {})} onClose={closeSheet}>{dismiss => <>
    {sheet === 'profile' && <ProfileEditor value={name} onApply={value => {setName(value); dismiss();}}/>}
    {sheet === 'theme' && (['light', 'dark', 'system'] satisfies ThemeMode[]).map(value => <SettingsChoice key={value} label={themeLabels[value]} detail={value === 'light' ? '밝고 선명한 화면' : value === 'dark' ? '눈이 편안한 어두운 화면' : '기기의 설정에 맞춰 자동으로'} selected={mode === value} onPress={() => {setMode(value); dismiss();}}/>)}
    {sheet === 'display' && chatDisplayModes.map(value => <SettingsChoice key={value} label={chatDisplayLabels[value]} detail={chatDisplayDescriptions[value]} selected={chatDisplay === value} onPress={() => {setChatDisplay(value); dismiss();}}/>)}
    {sheet === 'language' && ['한국어', 'English', '日本語'].map(value => <SettingsChoice key={value} label={value} selected={language === value} onPress={() => choose(setLanguage, value, dismiss)}/>)}
  </>}</SettingsSheet>;

  return <SwipeBackModal onClose={onClose} active={page === null}>{close => <>
    <SettingsPage home onBack={close} obscured={page !== null || sheet !== null}>
      <SettingsPressable testID="settings-profile" accessibilityRole="button" accessibilityLabel="프로필 수정" onPress={() => setSheet('profile')} radius={r.controlRadius * s} style={{marginBottom: r.profileBottom * s}} contentStyle={{flexDirection: 'row', alignItems: 'center', gap: r.profileGap * s, paddingHorizontal: r.profileInset * s, minHeight: r.profileSize * s}}>
        <View accessible={false} style={{width: r.profileSize * s, height: r.profileSize * s, borderRadius: r.profileSize * s / 2, backgroundColor: p.avatarBackground, alignItems: 'center'}}>
          <View style={{position: 'absolute', top: 20 * s, width: 26 * s, height: 26 * s, borderRadius: 13 * s, backgroundColor: p.avatarForeground}}/>
          <View style={{position: 'absolute', top: 49 * s, width: 51 * s, height: 26 * s, borderTopLeftRadius: 30 * s, borderTopRightRadius: 30 * s, borderBottomLeftRadius: 14 * s, borderBottomRightRadius: 14 * s, backgroundColor: p.avatarForeground}}/>
        </View>
        <View style={{flex: 1, gap: 8 * s}}><Text numberOfLines={1} style={{color: p.text, fontSize: 32 * s, lineHeight: 44 * s, fontWeight: '700', includeFontPadding: false}}>{name}</Text><Text style={{color: p.secondary, fontSize: 24 * s, lineHeight: 34 * s, includeFontPadding: false}}>내 정보</Text></View>
        <SettingsIcon name="chevron" size={24 * s} color={p.faint}/>
      </SettingsPressable>
      {settingsGroups.map((group, index) => <SettingsGroup key={index}>
        {group.map(key => <SettingsRow key={key} label={key === 'language' ? sheetTitles[key] : pageTitles[key]} {...(values[key] ? {value: values[key]} : {})} muted={key === 'ai'} onPress={() => key === 'language' ? setSheet(key) : setPage(key)}/>)}
      </SettingsGroup>)}
      <Text style={{marginLeft: 6 * s, marginTop: 34 * s, color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s}}>Promlive 0.1.0</Text>
    </SettingsPage>

    {page === 'ai' && (aiReady ? <AiSettingsPreview value={ai} onChange={onAiChange} saveError={aiError} onClose={() => setPage(null)}/> : <SwipeBackModal onClose={() => setPage(null)}>{back => <SettingsPage title="AI" onBack={back}><ActivityIndicator color={p.secondary}/></SettingsPage>}</SwipeBackModal>)}
    {page !== null && page !== 'ai' && <SwipeBackModal onClose={() => {setSheet(null); setPage(null);}}>{back => <><SettingsPage title={pageTitles[page]} onBack={back} obscured={sheet !== null}>
      {page === 'theme' && <>
        <SettingsRow plain label="화면 색상" value={themeLabels[mode]} onPress={() => setSheet('theme')}/>
        <SettingsRow plain label="대화 표시" value={chatDisplayLabels[chatDisplay]} onPress={() => setSheet('display')}/>
      </>}
      {page === 'persona' && <PersonaEditor value={persona} onApply={value => {setPersona(value); back();}}/>}
      {page === 'prompt' && <PromptEditor value={prompt} onApply={value => {setPrompt(value); back();}}/>}
      {page === 'plugins' && <SettingsNote>등록된 플러그인이 없어요.</SettingsNote>}
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
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  const radius = useSettingsRadius('control');
  return <View style={{gap: 14 * s, marginTop: 24 * s}}>
    <Text style={{color: p.secondary, fontSize: 24 * s, lineHeight: 34 * s}}>{label}</Text>
    <SwipeBackBoundary><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} multiline={multiline} maxLength={maxLength} placeholder={placeholder} placeholderTextColor={p.faint} selectionColor={p.accent} underlineColorAndroid="transparent" textAlignVertical={multiline ? 'top' : 'center'} style={{backgroundColor: p.control, borderRadius: radius, paddingHorizontal: 24 * s, paddingVertical: 20 * s, color: p.text, fontSize: 27 * s, lineHeight: 40 * s, minHeight: (multiline ? 220 : 82) * s}}/></SwipeBackBoundary>
  </View>;
}

function ProfileEditor({value, onApply}: {value: string; onApply: (value: string) => void}) {
  const [name, setName] = useState(value);
  return <><SettingsField label="이름" value={name} onChange={setName} placeholder="이름을 입력해 주세요" maxLength={24}/><SettingsSave disabled={!name.trim()} onPress={() => onApply(name.trim())}/></>;
}

function PersonaEditor({value, onApply}: {value: Persona; onApply: (value: Persona) => void}) {
  const [name, setName] = useState(value.name);
  const [description, setDescription] = useState(value.description);
  return <>
    <SettingsField label="페르소나 이름" value={name} onChange={setName} placeholder="대화에서 사용할 이름" maxLength={40}/>
    <SettingsField label="소개" value={description} onChange={setDescription} placeholder="나의 역할이나 성격을 적어보세요" multiline maxLength={2000}/>
    <SettingsSave disabled={!name.trim()} onPress={() => onApply({name: name.trim(), description: description.trim()})}/>
  </>;
}

function PromptEditor({value, onApply}: {value: string; onApply: (value: string) => void}) {
  const [prompt, setPrompt] = useState(value);
  return <>
    <SettingsField label="기본 프롬프트" value={prompt} onChange={setPrompt} placeholder="원하는 응답 방식과 말투를 적어보세요" multiline maxLength={4000}/>
    <SettingsSave onPress={() => onApply(prompt.trim())}/>
  </>;
}
