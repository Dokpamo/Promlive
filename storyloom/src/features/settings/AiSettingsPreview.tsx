import {useState, type Dispatch, type SetStateAction} from 'react';
import {Keyboard, KeyboardAvoidingView, Text, View} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';
import {SettingsChoice, SettingsGroup, SettingsPage, SettingsRow, SettingsSheet, useSettingsScale} from './SettingsLayout';
import {SwipeBackModal} from './SwipeBackModal';
import {AiAction, AiCaption, AiField, AiSection, AiToggle} from './AiSettingsControls';
import {aiServices, choosePreviewModel, dataPolicyLabels, effortLabels, filterLabels, lengthLabels, previewModel, routingLabels, safetyCategories, toolLabels, type AiConnectionPreview, type AiSettingsPreviewState} from './aiSettingsModel';

type Page = 'connection' | 'model' | 'reasoning' | 'response' | 'tools' | 'advanced';
type StringSetting = {[K in keyof AiConnectionPreview]: AiConnectionPreview[K] extends string ? K : never}[keyof AiConnectionPreview];
type Choice = {value: string; label: string; detail?: string};
type Sheet = {kind: 'services'} | {kind: 'choices'; title: string; caption?: string; value: string; choices: Choice[]; choose: (value: string) => void};
const pageNames: Record<Page, string> = {connection: 'AI 연결', model: '기본 모델', reasoning: '생각 수준', response: '답변 설정', tools: '사용할 도구', advanced: '고급 설정'};
const choicesFrom = (labels: Record<string, string>): Choice[] => Object.entries(labels).map(([value, label]) => ({value, label}));

/** Interactive settings preview only. Does not call a provider, save credentials, or change the AI runtime. */
export function AiSettingsPreview({value, onChange, onClose}: {
  value: AiSettingsPreviewState; onChange: Dispatch<SetStateAction<AiSettingsPreviewState>>; onClose: () => void;
}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  const service = aiServices.find(item => item.id === value.service)!;
  const connection = value.connections[value.service];
  const model = previewModel(service, connection.model);
  const [page, setPage] = useState<Page | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [manualModel, setManualModel] = useState('');
  const patch = (change: Partial<AiConnectionPreview>) => onChange(old => ({...old, connections: {...old.connections, [service.id]: {...old.connections[service.id], ...change}}}));
  const select = (title: string, selected: string, choices: Choice[], choose: (next: string) => void, caption?: string) => {
    Keyboard.dismiss();
    setSheet({kind: 'choices', title, value: selected, choices, choose, ...(caption ? {caption} : {})});
  };
  const openPage = (next: Page) => {
    setNotice('');
    if (next === 'model') {setQuery(''); setManualModel(service.models.some(item => item.id === connection.model) ? '' : connection.model);}
    setPage(next);
  };
  const field = (label: string, key: StringSetting, placeholder: string, detail?: string, numeric = false) => <AiField label={label} value={connection[key]} onChange={next => patch({[key]: next})} placeholder={placeholder} {...(detail ? {detail} : {})} {...(numeric ? {keyboard: 'decimal-pad' as const} : {})}/>;
  const hasReasoning = model.effort.length > 0;
  const thinkingOff = connection.thinking === 'disabled';
  const reasoningLabel = hasReasoning ? thinkingOff ? '사용 안 함' : effortLabels[connection.effort] ?? '모델 기본값' : '모델에 따름';
  const keyRequired = service.id !== 'custom' && !(service.id === 'ollama' && connection.ollamaMode === 'local');
  const chooseModel = (id: string, close: () => void) => {
    const next = previewModel(service, id);
    onChange(old => ({...old, connections: {...old.connections, [service.id]: choosePreviewModel(old.connections[service.id], next)}}));
    close();
  };

  function connectionPage(close: () => void) {
    return <>
      <SettingsGroup><SettingsRow label="프로바이더" value={service.name} onPress={() => {Keyboard.dismiss(); setSheet({kind: 'services'});}}/></SettingsGroup>
      <AiCaption>{service.detail}</AiCaption>
      {field('연결 이름', 'name', service.name)}
      {service.id === 'ollama' && <SettingsGroup><SettingsRow label="연결 위치" value={connection.ollamaMode === 'local' ? '내 컴퓨터' : 'Ollama Cloud'} onPress={() => select('연결 위치', connection.ollamaMode, [
        {value: 'local', label: '내 컴퓨터', detail: 'Ollama가 실행 중인 컴퓨터에 연결해요.'},
        {value: 'cloud', label: 'Ollama Cloud', detail: 'Ollama API 키로 클라우드 모델을 사용해요.'},
      ], next => patch({ollamaMode: next, url: next === 'local' ? 'http://localhost:11434' : 'https://ollama.com'}))}/></SettingsGroup>}
      {(service.id === 'ollama' || service.id === 'custom') && field('서버 주소', 'url', service.id === 'ollama' ? 'http://192.168.0.10:11434' : 'https://example.com/v1', service.id === 'ollama' && connection.ollamaMode === 'local' ? '휴대폰에서는 모델을 실행하는 컴퓨터의 주소를 입력해 주세요.' : undefined)}
      {service.id === 'custom' && <SettingsGroup><SettingsRow label="API 형식" value={connection.protocol === 'chat' ? 'Chat Completions' : 'Responses'} onPress={() => select('API 형식', connection.protocol, [{value: 'chat', label: 'Chat Completions'}, {value: 'responses', label: 'Responses'}], next => patch({protocol: next}), '연결할 서버가 지원하는 OpenAI 호환 형식을 선택해요.')}/></SettingsGroup>}
      {(keyRequired || service.id === 'custom') && <AiField key={service.id} label={service.id === 'custom' ? 'API 키 · 선택' : 'API 키'} secret value={connection.key} onChange={key => patch({key})} placeholder="API 키를 입력해 주세요" detail="미리보기에서는 키를 저장하거나 외부로 보내지 않아요."/>}
      {service.id === 'ollama' && connection.ollamaMode === 'local' && <AiCaption>기본 로컬 연결에는 API 키가 필요하지 않아요.</AiCaption>}
      <AiAction label="연결 확인" onPress={() => setNotice('현재는 UI 미리보기예요. 실제 연결 확인은 API 연동 후 사용할 수 있어요.')}/>
      {notice && <AiCaption>{notice}</AiCaption>}
      <AiAction label="적용" primary onPress={close}/>
    </>;
  }

  function modelPage(close: () => void) {
    const search = query.trim().toLowerCase();
    const models = service.models.filter(item => `${item.name} ${item.id}`.toLowerCase().includes(search));
    return <>
      <AiCaption>{service.name}에서 사용할 모델을 골라요. 연결 전에는 예시 목록을 보여줘요.</AiCaption>
      {service.models.length > 0 && <>
        <AiField label="모델 검색" value={query} onChange={setQuery} placeholder="이름이나 모델 ID로 검색"/>
        <SettingsGroup><View style={{paddingHorizontal: 28 * s}}>{models.map(item => <SettingsChoice key={item.id} label={item.name} detail={item.detail} selected={connection.model === item.id} onPress={() => chooseModel(item.id, close)}/>)}</View>{models.length === 0 && <View style={{paddingHorizontal: 28 * s}}><AiCaption>검색 결과가 없어요.</AiCaption></View>}</SettingsGroup>
      </>}
      {service.models.length === 0 && <AiCaption>{service.id === 'ollama' ? '서버에 설치한 모델 이름을 입력해 주세요.' : '서버에서 제공하는 모델 ID를 입력해 주세요.'}</AiCaption>}
      <AiAction label="모델 목록 새로고침" onPress={() => setNotice('실제 연결 후 사용할 수 있는 모델 목록을 불러와요.')}/>
      {notice && <AiCaption>{notice}</AiCaption>}
      <View style={{height: 28 * s}}/>
      <AiField label="모델 ID 직접 입력" value={manualModel} onChange={setManualModel} placeholder={service.id === 'ollama' ? '설치한 모델 이름' : '모델 ID'}/>
      {!!manualModel.trim() && <AiAction label="이 모델 사용" primary onPress={() => chooseModel(manualModel.trim(), close)}/>}
    </>;
  }

  function reasoningPage() {
    return <>
      <AiCaption>{model.name}{hasReasoning ? '의 생각하는 깊이를 조절해요. 깊게 생각할수록 응답 시간과 사용량이 늘어날 수 있어요.' : '에는 확인된 생각 수준 설정이 없어요. 실제 연결 후 지원 여부를 확인해요.'}</AiCaption>
      {model.thinking && <SettingsGroup><SettingsRow label="생각 모드" value={connection.thinking === 'default' ? '모델 기본값' : thinkingOff ? '사용 안 함' : service.id === 'anthropic' ? '적응형' : '사용'} onPress={() => select('생각 모드', connection.thinking, [
        {value: 'default', label: '모델 기본값'},
        {value: 'enabled', label: service.id === 'anthropic' ? '적응형' : '사용', detail: service.id === 'anthropic' ? '요청에 맞춰 생각하는 양을 조절해요.' : '답변 전에 충분히 생각해요.'},
        {value: 'disabled', label: '사용 안 함'},
      ], next => patch({thinking: next, effort: 'default'}))}/></SettingsGroup>}
      {hasReasoning && !thinkingOff && <SettingsGroup><View style={{paddingHorizontal: 28 * s}}>{['default', ...model.effort].map(effort => <SettingsChoice key={effort} label={effortLabels[effort] ?? effort} selected={connection.effort === effort} onPress={() => patch({effort})}/>)}</View></SettingsGroup>}
      {thinkingOff && <AiCaption>생각 모드를 켜면 추론 강도를 고를 수 있어요.</AiCaption>}
    </>;
  }

  function responsePage() {
    return <>
      <AiSection>응답 방식</AiSection>
      <SettingsGroup><SettingsRow label="답변 길이" value={lengthLabels[connection.length] ?? '균형 있게'} onPress={() => select('답변 길이', connection.length, choicesFrom(lengthLabels), next => patch({length: next}), '원하는 답변 길이를 안내하는 설정이에요. 생성량 제한과는 달라요.')}/>
        {model.verbosity && <SettingsRow label="답변 상세도" value={{default: '모델 기본값', low: '낮음', medium: '보통', high: '높음'}[connection.verbosity] ?? '모델 기본값'} onPress={() => select('답변 상세도', connection.verbosity, choicesFrom({default: '모델 기본값', low: '낮음', medium: '보통', high: '높음'}), next => patch({verbosity: next}))}/>}
        <SettingsRow label="최대 생성량" value={connection.maxTokens === 'default' ? '모델 기본값' : `${Number(connection.maxTokens).toLocaleString()} 토큰`} onPress={() => select('최대 생성량', connection.maxTokens, [{value: 'default', label: '모델 기본값'}, ...['2048', '4096', '8192', '16384'].map(tokens => ({value: tokens, label: `${Number(tokens).toLocaleString()} 토큰`}))], next => patch({maxTokens: next}), '생각에 사용한 토큰까지 포함될 수 있어요. 한도에 도달하면 답변이 중간에 끝날 수 있어요.')}/>
      </SettingsGroup>
      <AiCaption>말투와 역할은 페르소나·프롬프트에서 설정해요.</AiCaption>
    </>;
  }

  function toolsPage() {
    return <>
      <AiCaption>{model.name}에서 사용할 도구를 선택해요.</AiCaption>
      {model.tools.length > 0 ? <SettingsGroup>{model.tools.map(tool => <AiToggle key={tool} label={toolLabels[tool].name} detail={toolLabels[tool].detail} value={connection.tools.includes(tool)} onChange={enabled => patch({tools: enabled ? [...connection.tools, tool] : connection.tools.filter(item => item !== tool)})}/>)}</SettingsGroup> : <AiCaption>{service.id === 'openrouter' ? '내장 도구는 모델과 처리 업체에 따라 달라요. 실제 연결 후 지원하는 도구를 표시해요.' : '이 모델에 연결된 내장 도구가 없어요.'}</AiCaption>}
      <AiCaption>추가 기능은 플러그인에서 관리해요.</AiCaption>
    </>;
  }

  function advancedPage() {
    const sampling = model.sampling && (service.id !== 'deepseek' || thinkingOff);
    return <>
      {service.id === 'openrouter' && <>
        <AiSection>처리 업체와 라우팅</AiSection>
        <SettingsGroup><SettingsRow label="우선순위" value={routingLabels[connection.routing] ?? '자동'} onPress={() => select('라우팅 우선순위', connection.routing, choicesFrom(routingLabels), next => patch({routing: next}), '같은 모델을 제공하는 업체 중 요청을 보낼 곳을 골라요.')}/>
          <AiToggle label="다른 업체로 전환" detail="선택한 업체가 응답하지 않으면 다른 업체를 시도해요." value={connection.fallback} onChange={fallback => patch({fallback})}/>
          <SettingsRow label="데이터 정책" value={dataPolicyLabels[connection.dataPolicy] ?? '계정 기본값'} onPress={() => select('데이터 정책', connection.dataPolicy, choicesFrom(dataPolicyLabels), next => patch({dataPolicy: next}))}/>
        </SettingsGroup>
        {field('처리 업체 지정 · 선택', 'hosts', '예: anthropic, deepinfra', '비워 두면 자동으로 선택해요. 실제 연결 후 해당 모델의 업체 목록을 제공해요.')}
        <AiSection>단가 상한</AiSection>
        {field('입력 · 100만 토큰당 달러', 'inputPrice', '제한 없음', undefined, true)}
        {field('출력 · 100만 토큰당 달러', 'outputPrice', '제한 없음', undefined, true)}
      </>}
      {service.id === 'google' && <>
        <AiSection>콘텐츠 필터</AiSection>
        <SettingsGroup>{Object.entries(safetyCategories).map(([key, label]) => <SettingsRow key={key} label={label} value={filterLabels[connection.filters[key] ?? 'default'] ?? '서비스 기본값'} onPress={() => select(label, connection.filters[key] ?? 'default', choicesFrom(filterLabels), next => patch({filters: {...connection.filters, [key]: next}}))}/>)}</SettingsGroup>
        <AiCaption>서비스에서 허용하는 범위 안에서 차단 기준을 선택해요.</AiCaption>
      </>}
      {service.id === 'ollama' && connection.ollamaMode === 'local' && <>
        <AiSection>로컬 모델</AiSection>
        {field('컨텍스트 크기', 'context', '모델 기본값', '대화에 사용할 토큰 수예요. 크게 설정할수록 메모리가 더 필요해요.', true)}
        <SettingsGroup><SettingsRow label="메모리에 유지" value={{default: '서버 기본값', '0': '바로 해제', '5m': '5분', '30m': '30분', '-1': '계속 유지'}[connection.keepAlive] ?? '서버 기본값'} onPress={() => select('모델을 메모리에 유지', connection.keepAlive, choicesFrom({default: '서버 기본값', '0': '바로 해제', '5m': '5분', '30m': '30분', '-1': '계속 유지'}), next => patch({keepAlive: next}))}/></SettingsGroup>
      </>}
      {service.id === 'ollama' && connection.ollamaMode === 'cloud' && <AiCaption>Ollama Cloud에서는 서버가 모델을 관리해요. 로컬 메모리·컨텍스트 설정은 내 컴퓨터 연결에서 사용할 수 있어요.</AiCaption>}
      {sampling && <>
        <AiSection>생성 옵션</AiSection>
        {field('Temperature', 'temperature', '모델 기본값', '응답의 무작위성을 조절해요.', true)}
        {service.id !== 'deepseek' && field('Top P', 'topP', '모델 기본값', '다음 단어를 고를 후보 범위를 조절해요.', true)}
        {field('중단 문자열', 'stop', '사용 안 함', '이 문자열을 생성하면 답변을 멈춰요.')}
      </>}
      {service.id === 'deepseek' && !thinkingOff && <>
        <AiSection>추론 생성 옵션</AiSection>
        {field('Top P', 'topP', '모델 기본값 · 0.95–1.0', '생각 모드에서는 이 범위만 적용돼요.', true)}
        <AiCaption>생각 모드에서는 Temperature가 적용되지 않아요.</AiCaption>
      </>}
      {!sampling && !['openrouter', 'google', 'ollama', 'deepseek'].includes(service.id) && <AiCaption>{service.id === 'custom' ? '직접 입력한 모델의 지원 옵션은 연결 후 확인해요.' : '이 모델에서는 확인된 생성 옵션만 표시해요. 생각 수준과 답변 설정에서 응답 방식을 조절할 수 있어요.'}</AiCaption>}
      {service.id !== 'ollama' && service.id !== 'custom' && <><AiSection>연결 주소</AiSection>{field('API 주소', 'url', service.url, '기본 주소를 사용해도 돼요.')}</>}
    </>;
  }

  return <SwipeBackModal onClose={onClose} active={page === null && sheet === null}>{back => <>
    <SettingsPage title="AI" onBack={back}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 20 * s, marginHorizontal: 6 * s, marginBottom: 32 * s}}>
        <View style={{width: 70 * s, height: 70 * s, borderRadius: 24 * s, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center'}}><Text style={{color: p.text, fontSize: 34 * s}}>{service.mark}</Text></View>
        <View style={{flex: 1, gap: 3 * s}}><Text style={{color: p.text, fontSize: 28 * s, lineHeight: 40 * s}}>{connection.name || service.name}</Text><Text style={{color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s}}>연결 전</Text></View>
      </View>
      <SettingsGroup><SettingsRow label="AI 연결" value={service.name} onPress={() => openPage('connection')}/><SettingsRow label="기본 모델" value={model.name} onPress={() => openPage('model')}/></SettingsGroup>
      <SettingsGroup><SettingsRow label="생각 수준" value={reasoningLabel} onPress={() => openPage('reasoning')}/><SettingsRow label="답변 설정" value={lengthLabels[connection.length] ?? '균형 있게'} onPress={() => openPage('response')}/><SettingsRow label="사용할 도구" value={connection.tools.length ? `${connection.tools.length}개` : '사용 안 함'} onPress={() => openPage('tools')}/></SettingsGroup>
      <SettingsGroup><SettingsRow label="고급 설정" onPress={() => openPage('advanced')}/></SettingsGroup>
      <AiCaption>설정 미리보기예요. 실제 AI 연결과 요청은 실행하지 않아요.</AiCaption>
    </SettingsPage>
    {page && <SwipeBackModal onClose={() => {Keyboard.dismiss(); setPage(null);}} active={sheet === null}>{close => <KeyboardAvoidingView style={{flex: 1}} behavior="padding"><SettingsPage title={pageNames[page]} onBack={close}>
      {page === 'connection' && connectionPage(close)}
      {page === 'model' && modelPage(close)}
      {page === 'reasoning' && reasoningPage()}
      {page === 'response' && responsePage()}
      {page === 'tools' && toolsPage()}
      {page === 'advanced' && advancedPage()}
    </SettingsPage></KeyboardAvoidingView>}</SwipeBackModal>}
    {sheet && <SettingsSheet title={sheet.kind === 'services' ? '프로바이더' : sheet.title} {...(sheet.kind === 'choices' && sheet.caption ? {caption: sheet.caption} : {})} onClose={() => setSheet(null)}>{close => sheet.kind === 'services' ? <>
      {aiServices.map(item => <SettingsChoice key={item.id} label={item.name} detail={item.detail} selected={service.id === item.id} onPress={() => {onChange(old => ({...old, service: item.id})); setNotice(''); close();}}/>)}
    </> : <>{sheet.choices.map(item => <SettingsChoice key={item.value} label={item.label} {...(item.detail ? {detail: item.detail} : {})} selected={sheet.value === item.value} onPress={() => {sheet.choose(item.value); close();}}/>)}</>}</SettingsSheet>}
  </>}</SwipeBackModal>;
}
