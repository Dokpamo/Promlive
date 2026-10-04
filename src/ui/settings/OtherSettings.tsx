import {useEffect, useState, useSyncExternalStore} from 'react';
import {Text} from 'react-native';
import {usePalette} from '../Theme';
import {settingsDetailLayout} from '../tokens';
import type {SettingsServices} from '../../app/settingsServices';
import {themeLabels, type ThemeMode} from '../../features/settings/generalPreferences';
import type {SummaryExtensions} from '../../extensions/SummaryExtensions';
import {ChoicePage, choicesFrom, Field, Note, Section, SettingRow, SettingsPage, TextAction, type SettingsNavigation} from './controls';
export type SettingsDestination = 'ai' | 'personas' | 'profile' | 'prompt' | 'theme' | 'language' | 'plugins' | 'info';
export function OtherSettings({page, services, nav}: {page: SettingsDestination; services: SettingsServices; nav: SettingsNavigation}) {
  const state = useSyncExternalStore(services.general.subscribe, services.general.snapshot);
  const colors = usePalette();
  const titles: Partial<Record<SettingsDestination, string>> = {prompt: '프롬프트', theme: '테마', language: '언어', plugins: '플러그인', info: '정보'};
  if (page === 'language') return <ChoicePage nav={nav} title="언어" value={state.language} choices={['한국어', 'English', '日本語'].map(value => ({value, label: value}))}
    onChoose={language => services.general.update({language})}/>;
  return <SettingsPage title={titles[page] ?? '설정'} nav={nav} testID={`ui-settings-${page}`}>
    {!!state.error && <><Note error>{state.error}</Note><TextAction label="저장 다시 시도" onPress={() => services.general.update({})}/></>}
    {page === 'theme' && <SettingRow testID="ui-theme-mode" label="화면 색상" value={themeLabels[state.theme]} onPress={() => nav.push(child => <ChoicePage nav={child} title="화면 색상"
      value={state.theme} choices={choicesFrom(themeLabels)} onChoose={theme => services.general.update({theme: theme as ThemeMode})}/>)}/>}
    {page === 'prompt' && <><Field label="기본 프롬프트" testID="ui-settings-prompt-input" value={state.prompt} onChange={prompt => services.general.update({prompt})} multiline maxLength={4000} placeholder="원하는 말투와 응답 방식을 적어 주세요."/>
      <Note>기기에 자동 저장돼요. 대화에 적용하는 기능은 준비 중이에요.</Note></>}
    {page === 'plugins' && (services.extensions ? <PluginSettings extensions={services.extensions} nav={nav}/> : <Note>등록된 플러그인이 없어요.</Note>)}
    {page === 'info' && <><Text style={{fontSize: 30, fontWeight: '700', color: colors.foreground, marginHorizontal: settingsDetailLayout.horizontalInset, marginVertical: 14}}>Promlive</Text>
      <Note>이야기가 시작되는 대화.</Note><SettingRow label="앱 버전" value="0.1.0"/></>}
  </SettingsPage>;
}
function PluginSettings({extensions, nav}: {extensions: SummaryExtensions; nav: SettingsNavigation}) {
  const state = useSyncExternalStore(extensions.subscribe, extensions.snapshot);
  const [instruction, setInstruction] = useState('');
  useEffect(() => () => {extensions.cancelGeneration(); extensions.cancelPreview();}, [extensions]);
  return <>
    <Section>대화 요약</Section><Note>최근 대화를 읽고 선택한 AI로 요약해 저장하는 개인 플러그인이에요.</Note>
    {!!state.error && <Note error>{state.error}</Note>}
    <SettingRow label="상태" value={state.extension.enabled ? `버전 ${state.extension.activeVersion} 사용 중` : '사용 안 함'}/>
    {state.extension.enabled && <TextAction label="사용 중지" onPress={() => {void extensions.disable();}}/>}
    <Field label="원하는 요약 방식" value={instruction} onChange={setInstruction} maxLength={3000} multiline placeholder="인물 관계와 중요한 사건을 정리해 주세요."/>
    <TextAction label={state.building ? '생성 취소' : '플러그인 생성'} disabled={!state.building && !instruction.trim()} onPress={() => state.building ? extensions.cancelGeneration() : void extensions.generate(instruction)}/>
    <Note>생성·미리보기는 설정한 AI를 사용하며 API 사용량이 발생할 수 있어요.</Note>
    {state.extension.versions.map(item => <SettingRow key={item.version} label={item.program.name} value={`버전 ${item.version}`} onPress={() => nav.push(child => <PluginReview extensions={extensions} nav={child} version={item.version}/>)}/>)}
  </>;
}
function PluginReview({extensions, nav, version}: {extensions: SummaryExtensions; nav: SettingsNavigation; version: number}) {
  const {extension, preview, previewing, error} = useSyncExternalStore(extensions.subscribe, extensions.snapshot);
  const item = extension.versions.find(item => item.version === version);
  const [reviewedRevision] = useState(extension.revision);
  const [busy, setBusy] = useState(false);
  if (!item) return <SettingsPage title="플러그인" nav={nav}><Note>이 버전을 찾을 수 없어요.</Note></SettingsPage>;
  return <SettingsPage title={item.program.name} nav={nav}>
    <Note>{item.program.description}</Note><Section>사용할 권한</Section>
    <SettingRow label="현재 대화 읽기" value={`최근 ${item.program.steps[0].limit}개`}/><SettingRow label="선택한 AI로 생성"/><SettingRow label="요약 결과 저장"/>
    <Section>요약 지침</Section><Note>{item.program.steps[1].instruction}</Note>
    {!!error && <Note error>{error}</Note>}
    <TextAction label={previewing ? '미리보기 취소' : '예시 대화로 미리보기'} onPress={() => previewing ? extensions.cancelPreview() : void extensions.preview(version)}/>
    {preview?.version === version && <Note>{preview.content}</Note>}
    <TextAction label="권한을 허용하고 사용" disabled={busy || extension.revision !== reviewedRevision} onPress={() => {
      setBusy(true); void extensions.activate(version, reviewedRevision).then(() => {if (!extensions.snapshot().error) nav.back();}).finally(() => setBusy(false));
    }}/>
    {extension.revision !== reviewedRevision && <Note>버전이 변경됐어요. 뒤로 돌아가 다시 확인해 주세요.</Note>}
  </SettingsPage>;
}
