import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Text, View} from 'react-native';
import {AppearanceProvider, useAppearance, type ThemeMode} from '../../src/features/appearance/AppAppearance';
import {AnimatedModelList, catalogArrivalTiming} from '../../src/features/settings/AnimatedModelList';
import {useSettingsScale} from '../../src/features/settings/SettingsLayout';
import {panelReference} from '../../src/layout/panelGeometry';
import type {AiModelPreview} from '../../src/features/settings/aiSettingsModel';
import './model-arrival.css';

const existing: AiModelPreview[] = [
  {id: 'demo-current', name: '기존 모델 A', detail: '지금 선택한 모델', effort: [], tools: []},
  {id: 'demo-fast', name: '기존 모델 B', detail: '빠른 답변', effort: [], tools: []},
  {id: 'demo-general', name: '기존 모델 C', detail: '일반 대화', effort: [], tools: []},
];
const arriving: AiModelPreview[] = [
  {id: 'demo-new-a', name: '새 모델 A', detail: '이번 조회에서 새로 발견한 모델', effort: [], tools: []},
  {id: 'demo-new-b', name: '새 모델 B', detail: '함께 추가되는 모델', effort: [], tools: []},
];
const noop = () => {};
const params = new URLSearchParams(window.location.search);
const previewDuration = Math.max(catalogArrivalTiming.shiftDuration, catalogArrivalTiming.revealDelay + catalogArrivalTiming.revealDuration);

function ArrivalStage({count}: {count: number}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  const [models, setModels] = useState(existing);
  const [selected, setSelected] = useState(existing[0]!.id);
  const [phase, setPhase] = useState('기존 목록을 먼저 보여줘요');

  useEffect(() => {
    setModels([...arriving.slice(0, count), ...existing]);
    setPhase('업데이트와 함께 목록이 내려가요');
    const reveal = window.setTimeout(() => setPhase(`목록이 멈추며 새 모델 ${count}개가 나타나요`), catalogArrivalTiming.revealDelay);
    const settled = window.setTimeout(() => setPhase('기존 선택은 그대로 유지돼요'), previewDuration + 500);
    return () => {window.clearTimeout(reveal); window.clearTimeout(settled);};
  }, [count]);

  return <View style={{flex: 1, backgroundColor: p.background, padding: panelReference.sheetInset * s, justifyContent: 'center'}}>
    <View style={{minHeight: 850 * s, borderRadius: panelReference.radius * s, backgroundColor: p.sheet, paddingHorizontal: panelReference.sheetPadding * s, paddingBottom: panelReference.groupPadding * s, overflow: 'hidden'}}>
      <View style={{alignItems: 'center', paddingTop: panelReference.sheetHandle.top * s, height: 58 * s}}>
        <View style={{width: panelReference.sheetHandle.width * s, height: panelReference.sheetHandle.height * s, borderRadius: panelReference.sheetHandle.radius * s, backgroundColor: p.divider}}/>
      </View>
      <Text style={{color: p.text, fontSize: 32 * s, lineHeight: 44 * s, marginTop: 15 * s}}>모델</Text>
      <Text accessibilityLiveRegion="polite" style={{color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s, marginTop: 16 * s, marginBottom: panelReference.sheetContentGap * s}}>{phase}</Text>
      <AnimatedModelList models={models} selected={selected} onSelect={model => setSelected(model.id)}/>
    </View>
  </View>;
}

function Preview() {
  const [count, setCount] = useState(1);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [run, setRun] = useState(0);
  const source = `${window.location.pathname}?stage=1&count=${count}&theme=${theme}`;

  return <main className="preview" data-theme={theme}>
    <div className="preview-panel">
    <header className="preview-heading">
      <span className="preview-brand">Promlive</span>
      <h1>새 모델이 추가되는 순간</h1>
      <p>목록이 내려가는 끝부분에 새 모델이 이어서 나타나요.</p>
    </header>
    <div className="preview-controls">
      <div className="preview-segment" aria-label="추가할 모델 수">
        {[1, 2].map(value => <button key={value} type="button" aria-pressed={count === value} onClick={() => {setCount(value); setRun(current => current + 1);}}>새 모델 {value}개</button>)}
      </div>
      <button className="preview-theme" type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? '다크로 보기' : '라이트로 보기'}</button>
    </div>
    <button className="preview-replay" type="button" onClick={() => setRun(current => current + 1)}>다시 재생</button>
    <p className="preview-note">미리보기 · 업데이트 즉시 시작 · {previewDuration / 1000}초</p>
    </div>
    <iframe key={`${run}-${theme}-${count}`} className="preview-stage" title="모델 목록 추가 애니메이션" src={source}/>
  </main>;
}

if (params.has('stage')) {
  document.documentElement.classList.add('arrival-stage');
  const mode: ThemeMode = params.get('theme') === 'dark' ? 'dark' : 'light';
  createRoot(document.getElementById('root')!).render(
    <AppearanceProvider mode={mode} setMode={noop} chatDisplay="default" setChatDisplay={noop}>
      <ArrivalStage count={params.get('count') === '2' ? 2 : 1}/>
    </AppearanceProvider>,
  );
} else {
  createRoot(document.getElementById('root')!).render(<Preview/>);
}
