import {useState, useSyncExternalStore} from 'react';
import {ActivityIndicator, Text, View} from 'react-native';
import {useAppearance} from '../features/appearance/AppAppearance';
import {AiAction, AiToggle} from '../features/settings/AiSettingsControls';
import {SettingsGroup, SettingsNote, SettingsRow, useSettingsScale} from '../features/settings/SettingsLayout';
import {SettingsSubtitle} from '../features/settings/SettingsSubtitle';
import {SettingsTextField} from '../features/settings/SettingsTextField';
import type {SummaryExtensions} from './SummaryExtensions';

export function SummaryExtensionSettings({extensions}: {extensions: SummaryExtensions}) {
  const state = useSyncExternalStore(extensions.subscribe, extensions.snapshot);
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  const [instruction, setInstruction] = useState('현재 대화의 핵심 사건, 인물 관계, 다음에 이어갈 내용을 요약하는 버튼을 만들어 줘.');
  const [review, setReview] = useState<number | null>(null);
  const current = state.extension;
  const selected = current.versions.find(item => item.version === (review ?? current.draftVersion ?? current.activeVersion));
  const active = extensions.active();
  if (!state.ready) return <ActivityIndicator color={p.secondary}/>;
  return <View testID="summary-extension-settings">
    <SettingsSubtitle>대화 요약</SettingsSubtitle>
    {current.activeVersion !== null && <SettingsGroup><AiToggle label="요약 버튼 사용" value={!!active} onChange={enabled => {if (enabled) setReview(current.activeVersion); else void extensions.disable();}}/></SettingsGroup>}
    <SettingsTextField label="만들고 싶은 기능" value={instruction} onChange={setInstruction} multiline maxLength={3000} placeholder="요약 버튼의 이름과 원하는 요약 방식을 적어 주세요"/>
    <AiAction label={state.building ? '생성 중단' : current.versions.length ? 'AI로 새 버전 만들기' : 'AI로 만들기'} primary={!state.building} disabled={!state.building && !instruction.trim()} onPress={() => {if (state.building) extensions.cancelGeneration(); else {setReview(null); void extensions.generate(instruction);}}}/>
    <SettingsNote>설정에서 선택한 xAI API 모델을 사용해요. 생성 후 내용을 확인하고 적용할 수 있어요.</SettingsNote>
    {!!state.error && <Text accessibilityRole="alert" style={{color: p.text, fontSize: 24 * s, lineHeight: 36 * s, marginVertical: 20 * s}}>{state.error}</Text>}
    {selected && <View style={{marginTop: 32 * s}}>
      <SettingsSubtitle>{`v${selected.version} · ${selected.version === current.draftVersion ? '적용 전 확인' : selected.version === current.activeVersion ? '현재 버전' : '복원할 버전'}`}</SettingsSubtitle>
      <SettingsGroup><View style={{padding: 28 * s, gap: 16 * s}}>
        <Text style={{color: p.text, fontSize: 30 * s, lineHeight: 42 * s}}>{selected.program.name}</Text>
        <Text style={{color: p.secondary, fontSize: 24 * s, lineHeight: 36 * s}}>{selected.program.description}</Text>
        <Text style={{color: p.text, fontSize: 24 * s, lineHeight: 36 * s}}>{`상단 버튼: ${selected.program.action.label}`}</Text>
        <Text selectable style={{color: p.text, fontSize: 24 * s, lineHeight: 36 * s}}>{selected.program.steps[1].instruction}</Text>
      </View></SettingsGroup>
      <SettingsNote>{`버튼을 누른 방의 최근 ${selected.program.steps[0].limit}개 메시지를 선택한 모델로 보내고 요약을 이 방의 플러그인 저장 공간에 보관해요. 입력 한도가 작으면 최근 메시지부터 사용해요.`}</SettingsNote>
      <AiAction label={state.previewing ? '미리보기 중단' : '예제 대화로 미리보기'} onPress={() => {if (state.previewing) extensions.cancelPreview(); else void extensions.preview(selected.version);}}/>
      {state.preview?.version === selected.version && <SettingsGroup><View style={{padding: 28 * s}}><Text style={{color: p.secondary, fontSize: 22 * s, marginBottom: 16 * s}}>예제 대화 · 실제 대화에는 저장되지 않아요</Text><Text selectable style={{color: p.text, fontSize: 26 * s, lineHeight: 40 * s}}>{state.preview.content}</Text></View></SettingsGroup>}
      {(!active || active.version !== selected.version) && <AiAction label={selected.version === current.draftVersion ? '권한 허용하고 적용' : '이 버전으로 복원'} primary onPress={() => void extensions.activate(selected.version, current.revision)}/>}
    </View>}
    {current.versions.length > 1 && <><SettingsSubtitle section>버전 기록</SettingsSubtitle><SettingsGroup>{current.versions.map(version => <SettingsRow key={version.version} label={`v${version.version} · ${version.program.name}`} value={version.version === current.activeVersion ? '현재' : version.version === current.draftVersion ? '초안' : '검토'} onPress={() => {extensions.cancelPreview(); setReview(version.version);}}/>)}</SettingsGroup><SettingsNote>이전 버전으로 복원해도 이미 저장한 요약은 유지돼요.</SettingsNote></>}
  </View>;
}
