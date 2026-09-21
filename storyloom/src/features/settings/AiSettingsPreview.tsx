import {useState, type Dispatch, type SetStateAction} from 'react';
import {Keyboard, KeyboardAvoidingView, Text, View} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';
import {SettingsChoice, SettingsGroup, SettingsPage, SettingsRow, SettingsSheet, useSettingsScale} from './SettingsLayout';
import {SwipeBackModal} from './SwipeBackModal';
import {AiAction, AiCaption, AiField, AiSection, AiToggle} from './AiSettingsControls';
import {aiServices, chooseConnectionRoute, choosePreviewModel, connectionModels, connectionRoute, connectionRoutes, createConnectionPreview, dataPolicyLabels, effortLabels, filterLabels, lengthLabels, modelPresetCapabilities, modelPresetFor, previewModel, routingLabels, safetyCategories, toolLabels, type AiConnectionPreview, type AiModelPresetPreview, type AiSettingsPreviewState} from './aiSettingsModel';

type Page = 'connection' | 'model' | 'appPreset' | 'modelPreset' | 'reasoning' | 'response' | 'tools' | 'advanced';
type StringSetting<T> = {[K in keyof T]: T[K] extends string ? K : never}[keyof T];
type Choice = {value: string; label: string; detail?: string};
type Sheet = {kind: 'services'} | {kind: 'choices'; title: string; caption?: string; value: string; choices: Choice[]; choose: (value: string) => void};
const pageNames: Record<Page, string> = {connection: 'AI 연결', model: '기본 모델', appPreset: '앱 프리셋', modelPreset: '모델 프리셋', reasoning: '생각 수준', response: '생성 설정', tools: '사용할 도구', advanced: '고급 설정'};
const choicesFrom = (labels: Record<string, string>): Choice[] => Object.entries(labels).map(([value, label]) => ({value, label}));

/** Interactive settings preview only. Does not call a provider, save credentials, or change the AI runtime. */
export function AiSettingsPreview({value, onChange, onClose}: {
  value: AiSettingsPreviewState; onChange: Dispatch<SetStateAction<AiSettingsPreviewState>>; onClose: () => void;
}) {
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  const service = aiServices.find(item => item.id === value.service)!;
  const connection = value.connections[value.service];
  const route = connectionRoute(service, connection);
  const routes = connectionRoutes(service);
  const catalog = connectionModels(service, connection);
  const model = previewModel(service, connection.model, connection);
  const preset = modelPresetFor(service.id, connection);
  const capabilities = modelPresetCapabilities(service, connection);
  const [pages, setPages] = useState<Page[]>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [manualModel, setManualModel] = useState('');
  const patch = (change: Partial<AiConnectionPreview>) => onChange(old => ({...old, connections: {...old.connections, [service.id]: {...old.connections[service.id], ...change}}}));
  const patchPreset = (change: Partial<AiModelPresetPreview>) => onChange(old => {
    const previous = old.connections[service.id];
    return {...old, connections: {...old.connections, [service.id]: {...previous, modelPresets: {...previous.modelPresets, [connection.model]: {...modelPresetFor(service.id, {...previous, model: connection.model}), ...change}}}}};
  });
  const select = (title: string, selected: string, choices: Choice[], choose: (next: string) => void, caption?: string) => {
    Keyboard.dismiss();
    setSheet({kind: 'choices', title, value: selected, choices, choose, ...(caption ? {caption} : {})});
  };
  const openPage = (next: Page) => {
    setNotice('');
    if (next === 'model') {setQuery(''); setManualModel(catalog.some(item => item.id === connection.model) ? '' : connection.model);}
    setPages(old => [...old, next]);
  };
  const connectionField = (label: string, key: StringSetting<AiConnectionPreview>, placeholder: string, detail?: string) => <AiField label={label} value={connection[key]} onChange={next => patch({[key]: next})} placeholder={placeholder} {...(detail ? {detail} : {})}/>;
  const field = (label: string, key: StringSetting<AiModelPresetPreview>, placeholder: string, detail?: string, numeric = false) => <AiField label={label} value={preset[key]} onChange={next => patchPreset({[key]: next})} placeholder={placeholder} {...(detail ? {detail} : {})} {...(numeric ? {keyboard: 'decimal-pad' as const} : {})}/>;
  const thinkingOff = preset.thinking === 'disabled';
  const adaptiveThinking = service.id === 'anthropic' || model.adaptiveThinking;
  const reasoningLabel = thinkingOff ? '생각 모드 끔' : preset.thinking === 'enabled' && model.effort.length === 0 ? adaptiveThinking ? '적응형' : '사용' : effortLabels[preset.effort] ?? 'API 기본값';
  const chooseModel = (id: string, close: () => void) => {
    const next = previewModel(service, id, connection);
    onChange(old => ({...old, connections: {...old.connections, [service.id]: choosePreviewModel(service.id, old.connections[service.id], next)}}));
    close();
  };

  function connectionPage(close: () => void) {
    return <>
      <SettingsGroup>
        <SettingsRow label="프로바이더" value={service.name} onPress={() => {Keyboard.dismiss(); setSheet({kind: 'services'});}}/>
        {routes.length > 1 && <SettingsRow label="연결 방식" value={route.name} onPress={() => select('연결 방식', route.id, routes.map(item => ({value: item.id, label: item.name, detail: item.detail})), id => {
          onChange(old => ({...old, connections: {...old.connections, [service.id]: chooseConnectionRoute(service, old.connections[service.id], id)}}));
          setNotice('');
        })}/>}
      </SettingsGroup>
      <AiCaption>{route.detail}</AiCaption>
      {connectionField('연결 이름', 'name', service.name)}
      {(service.id === 'ollama' || service.id === 'custom') && connectionField('서버 주소', 'url', service.id === 'ollama' ? 'http://192.168.0.10:11434' : 'https://example.com/v1', service.id === 'ollama' && connection.ollamaMode === 'local' ? '휴대폰에서는 모델을 실행하는 컴퓨터의 주소를 입력해 주세요.' : undefined)}
      {service.id === 'custom' && <SettingsGroup><SettingsRow label="API 형식" value={connection.protocol === 'chat' ? 'Chat Completions' : 'Responses'} onPress={() => select('API 형식', connection.protocol, [{value: 'chat', label: 'Chat Completions'}, {value: 'responses', label: 'Responses'}], next => patch({protocol: next}), '연결할 서버가 지원하는 OpenAI 호환 형식을 선택해요.')}/></SettingsGroup>}
      {(route.auth === 'apiKey' || route.auth === 'optionalKey') && <AiField key={`${service.id}-${route.id}`} label={route.auth === 'optionalKey' ? 'API 키 · 선택' : 'API 키'} secret value={connection.key} onChange={key => patch({key})} placeholder="API 키를 입력해 주세요" detail="미리보기에서는 키를 저장하거나 외부로 보내지 않아요."/>}
      {route.auth === 'oauth' ? <>
        {route.projectRequired && connectionField('Google Cloud 프로젝트 ID', 'project', '프로젝트 ID', 'Gemini 앱 구독이 아닌, Cloud 프로젝트의 API 권한으로 연결해요.')}
        <AiSection>계정 연결</AiSection>
        <AiCaption>로그인 화면 미리보기예요. 실제 로그인은 아직 실행하지 않아요.</AiCaption>
        <AiAction label={route.loginLabel ?? '계정으로 로그인'} primary onPress={() => setNotice('로그인 연동 준비 중이에요. 연결 후 이 계정에서 사용할 수 있는 모델을 불러와요.')}/>
      </> : <>
        {service.id !== 'ollama' && service.id !== 'custom' && connectionField('API 주소', 'url', route.url, service.id === 'qwen' ? 'Model Studio에 표시된 리전·워크스페이스 주소를 사용해 주세요.' : '선택한 연결 방식의 기본 주소예요.')}
        {route.auth === 'local' && <AiCaption>기본 로컬 연결에는 API 키가 필요하지 않아요.</AiCaption>}
        <AiAction label="연결 확인" onPress={() => setNotice('현재는 UI 미리보기예요. 실제 연결 확인은 API 연동 후 사용할 수 있어요.')}/>
      </>}
      {notice && <AiCaption>{notice}</AiCaption>}
      <AiAction label="적용" primary onPress={close}/>
    </>;
  }

  function modelPage(close: () => void) {
    const search = query.trim().toLowerCase();
    const models = catalog.filter(item => `${item.name} ${item.id}`.toLowerCase().includes(search));
    return <>
      <AiCaption>{service.name} · {route.name}{'\n'}연결 전에는 예시 목록을 보여줘요. 실제 사용 가능 여부는 연결 후 확인해요.</AiCaption>
      {catalog.length > 0 && <>
        <AiField label="모델 검색" value={query} onChange={setQuery} placeholder="이름이나 모델 ID로 검색"/>
        <SettingsGroup><View style={{paddingHorizontal: 28 * s}}>{models.map(item => <SettingsChoice key={item.id} label={item.name} detail={item.detail} selected={connection.model === item.id} onPress={() => chooseModel(item.id, close)}/>)}</View>{models.length === 0 && <View style={{paddingHorizontal: 28 * s}}><AiCaption>검색 결과가 없어요.</AiCaption></View>}</SettingsGroup>
      </>}
      {catalog.length === 0 && <AiCaption>{route.auth === 'oauth' ? '로그인 후 이 계정에서 사용할 수 있는 모델 목록이 여기에 표시돼요.' : service.id === 'ollama' ? '서버에서 사용할 모델 이름을 입력해 주세요.' : '서버에서 제공하는 모델 ID를 입력해 주세요.'}</AiCaption>}
      <AiAction label="모델 목록 새로고침" onPress={() => setNotice('실제 연결 후 사용할 수 있는 모델 목록을 불러와요.')}/>
      {notice && <AiCaption>{notice}</AiCaption>}
      <View style={{height: 28 * s}}/>
      <AiField label="모델 ID 직접 입력" value={manualModel} onChange={setManualModel} placeholder={service.id === 'ollama' ? '설치한 모델 이름' : '모델 ID'}/>
      {!!manualModel.trim() && <AiAction label="이 모델 사용" primary onPress={() => chooseModel(manualModel.trim(), close)}/>}
    </>;
  }

  function appPresetPage() {
    return <>
      <AiCaption>모든 프로바이더와 모델에서 공통으로 쓰는 대화 지침이에요. 모델을 바꿔도 유지돼요.</AiCaption>
      <SettingsGroup><SettingsRow label="답변 길이" value={lengthLabels[value.appPreset.length] ?? '지정 안 함'} onPress={() => select('답변 길이', value.appPreset.length, choicesFrom(lengthLabels), length => onChange(old => ({...old, appPreset: {...old.appPreset, length}})), '원하는 답변 길이를 프롬프트로 안내해요. API의 생성 토큰 한도를 바꾸지는 않아요.')}/></SettingsGroup>
      <AiCaption>‘지정 안 함’은 답변 길이에 관한 지시를 추가하지 않아요. 말투와 역할은 페르소나·프롬프트에서 설정해요.</AiCaption>
    </>;
  }

  function modelPresetPage() {
    const hasOptions = capabilities.reasoning || capabilities.output || capabilities.tools || capabilities.advanced;
    return <>
      <AiCaption>{service.name} · {model.name}{'\n'}선택한 모델에서 지원하는 API 옵션을 설정해요.</AiCaption>
      <SettingsGroup><SettingsRow label="모델" value={model.name} onPress={() => openPage('model')}/></SettingsGroup>
      {hasOptions ? <SettingsGroup>
        {capabilities.reasoning && <SettingsRow label="생각 수준" value={reasoningLabel} onPress={() => openPage('reasoning')}/>}
        {capabilities.output && <SettingsRow label="생성 설정" value={preset.maxTokens ? `${Number(preset.maxTokens).toLocaleString()} 토큰` : service.id === 'anthropic' ? '토큰 한도 입력' : 'API 기본값'} onPress={() => openPage('response')}/>}
        {capabilities.tools && <SettingsRow label="사용할 도구" value={preset.tools.length ? `${preset.tools.length}개` : '사용 안 함'} onPress={() => openPage('tools')}/>}
        {capabilities.advanced && <SettingsRow label="고급 설정" onPress={() => openPage('advanced')}/>}
      </SettingsGroup> : <AiCaption>이 모델의 지원 옵션을 아직 확인하지 못했어요. 실제 연결 후 확인된 항목을 표시해요.</AiCaption>}
      <AiCaption>‘API 기본값’은 해당 옵션을 따로 지정하지 않는다는 뜻이에요. 설정은 연결 방식과 모델별로 따로 유지돼요.</AiCaption>
    </>;
  }

  function reasoningPage() {
    return <>
      <AiCaption>{model.name}의 생각하는 깊이를 조절해요. 깊게 생각할수록 응답 시간과 사용량이 늘어날 수 있어요.</AiCaption>
      {model.thinking && <SettingsGroup><SettingsRow label="생각 모드" value={preset.thinking === 'default' ? 'API 기본값' : thinkingOff ? '사용 안 함' : adaptiveThinking ? '적응형' : '사용'} onPress={() => select('생각 모드', preset.thinking, [
        {value: 'default', label: 'API 기본값'},
        {value: 'enabled', label: adaptiveThinking ? '적응형' : '사용', detail: adaptiveThinking ? '요청에 맞춰 생각하는 양을 조절해요.' : '답변 전에 충분히 생각해요.'},
        {value: 'disabled', label: '사용 안 함'},
      ], next => patchPreset({thinking: next, effort: 'default'}))}/></SettingsGroup>}
      {capabilities.efforts.length > 0 && <SettingsGroup><View style={{paddingHorizontal: 28 * s}}>{['default', ...capabilities.efforts].map(effort => <SettingsChoice key={effort} label={effortLabels[effort] ?? effort} selected={preset.effort === effort} onPress={() => patchPreset({effort})}/>)}</View></SettingsGroup>}
      {thinkingOff && model.effortNeedsThinking && <AiCaption>생각 모드를 켜면 추론 강도를 고를 수 있어요.</AiCaption>}
      {model.samplingWithoutThinking && !thinkingOff && <AiCaption>생각 모드를 끄면 고급 설정에서 생성 옵션을 조절할 수 있어요.</AiCaption>}
    </>;
  }

  function responsePage() {
    return <>
      <AiCaption>{model.name}의 출력에 적용할 API 옵션이에요.</AiCaption>
      {model.verbosity && <SettingsGroup><SettingsRow label="답변 상세도" value={{default: 'API 기본값', low: '낮음', medium: '보통', high: '높음'}[preset.verbosity] ?? 'API 기본값'} onPress={() => select('답변 상세도', preset.verbosity, choicesFrom({default: 'API 기본값', low: '낮음', medium: '보통', high: '높음'}), next => patchPreset({verbosity: next}), '이 모델의 API가 제공하는 상세도 옵션이에요.')}/></SettingsGroup>}
      {field('최대 생성 토큰', 'maxTokens', service.id === 'anthropic' ? '토큰 수 입력 · 필수' : 'API 기본값', service.id === 'anthropic' ? '이 API는 토큰 한도를 반드시 지정해야 해요.' : '비워 두면 API 기본값을 사용해요.', true)}
      <AiCaption>생각에 사용한 토큰까지 포함될 수 있어요. 한도에 도달하면 답변이 중간에 끝날 수 있어요.</AiCaption>
    </>;
  }

  function toolsPage() {
    return <>
      <AiCaption>{model.name}에서 사용할 도구를 선택해요.</AiCaption>
      <SettingsGroup>{model.tools.map(tool => <AiToggle key={tool} label={toolLabels[tool].name} detail={toolLabels[tool].detail} value={preset.tools.includes(tool)} onChange={enabled => patchPreset({tools: enabled ? [...preset.tools, tool] : preset.tools.filter(item => item !== tool)})}/>)}</SettingsGroup>
      <AiCaption>추가 기능은 플러그인에서 관리해요.</AiCaption>
    </>;
  }

  function advancedPage() {
    return <>
      {capabilities.routing && <>
        <AiSection>처리 업체와 라우팅</AiSection>
        <SettingsGroup><SettingsRow label="우선순위" value={routingLabels[preset.routing] ?? '자동'} onPress={() => select('라우팅 우선순위', preset.routing, choicesFrom(routingLabels), next => patchPreset({routing: next}), '같은 모델을 제공하는 업체 중 요청을 보낼 곳을 골라요.')}/>
          <AiToggle label="다른 업체로 전환" detail="선택한 업체가 응답하지 않으면 다른 업체를 시도해요." value={preset.fallback} onChange={fallback => patchPreset({fallback})}/>
          <SettingsRow label="데이터 정책" value={dataPolicyLabels[preset.dataPolicy] ?? '계정 기본값'} onPress={() => select('데이터 정책', preset.dataPolicy, choicesFrom(dataPolicyLabels), next => patchPreset({dataPolicy: next}))}/>
        </SettingsGroup>
        {field('처리 업체 지정 · 선택', 'hosts', '예: anthropic, deepinfra', '비워 두면 자동으로 선택해요. 실제 연결 후 해당 모델의 업체 목록을 제공해요.')}
        <AiSection>단가 상한</AiSection>
        {field('입력 · 100만 토큰당 달러', 'inputPrice', '제한 없음', undefined, true)}
        {field('출력 · 100만 토큰당 달러', 'outputPrice', '제한 없음', undefined, true)}
      </>}
      {capabilities.filters && <>
        <AiSection>콘텐츠 필터</AiSection>
        <SettingsGroup>{Object.entries(safetyCategories).map(([key, label]) => <SettingsRow key={key} label={label} value={filterLabels[preset.filters[key] ?? 'default'] ?? '서비스 기본값'} onPress={() => select(label, preset.filters[key] ?? 'default', choicesFrom(filterLabels), next => patchPreset({filters: {...preset.filters, [key]: next}}))}/>)}</SettingsGroup>
        <AiCaption>서비스에서 허용하는 범위 안에서 차단 기준을 선택해요.</AiCaption>
      </>}
      {capabilities.localRuntime && <>
        <AiSection>로컬 모델</AiSection>
        {field('컨텍스트 크기', 'context', '모델 기본값', '대화에 사용할 토큰 수예요. 크게 설정할수록 메모리가 더 필요해요.', true)}
        <SettingsGroup><SettingsRow label="메모리에 유지" value={{default: '서버 기본값', '0': '바로 해제', '5m': '5분', '30m': '30분', '-1': '계속 유지'}[preset.keepAlive] ?? '서버 기본값'} onPress={() => select('모델을 메모리에 유지', preset.keepAlive, choicesFrom({default: '서버 기본값', '0': '바로 해제', '5m': '5분', '30m': '30분', '-1': '계속 유지'}), next => patchPreset({keepAlive: next}))}/></SettingsGroup>
      </>}
      {capabilities.sampling && <>
        <AiSection>생성 옵션</AiSection>
        {field('Temperature', 'temperature', '모델 기본값', '응답의 무작위성을 조절해요.', true)}
        {service.id !== 'deepseek' && field('Top P', 'topP', '모델 기본값', '다음 단어를 고를 후보 범위를 조절해요.', true)}
        {capabilities.stop && field('중단 문자열', 'stop', '사용 안 함', '이 문자열을 생성하면 답변을 멈춰요.')}
      </>}
      {capabilities.reasoningTopP && <>
        <AiSection>추론 생성 옵션</AiSection>
        {field('Top P', 'topP', '모델 기본값 · 0.95–1.0', '생각 모드에서는 이 범위만 적용돼요.', true)}
        <AiCaption>생각 모드에서는 Temperature가 적용되지 않아요.</AiCaption>
      </>}
    </>;
  }

  return <SwipeBackModal onClose={onClose} active={pages.length === 0 && sheet === null}>{back => <>
    <SettingsPage title="AI" onBack={back}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 20 * s, marginHorizontal: 6 * s, marginBottom: 32 * s}}>
        <View style={{width: 70 * s, height: 70 * s, borderRadius: 24 * s, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center'}}><Text style={{color: p.text, fontSize: 34 * s}}>{service.mark}</Text></View>
        <View style={{flex: 1, gap: 3 * s}}><Text style={{color: p.text, fontSize: 28 * s, lineHeight: 40 * s}}>{connection.name || service.name}</Text><Text style={{color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s}}>{route.name} · 연결 전</Text></View>
      </View>
      <SettingsGroup><SettingsRow label="AI 연결" value={service.name} onPress={() => openPage('connection')}/><SettingsRow label="기본 모델" value={model.name} onPress={() => openPage('model')}/></SettingsGroup>
      <AiSection>프리셋</AiSection>
      <SettingsGroup><SettingsRow label="앱 프리셋" value="공통" onPress={() => openPage('appPreset')}/><SettingsRow label="모델 프리셋" value={model.name} onPress={() => openPage('modelPreset')}/></SettingsGroup>
      <AiCaption>설정 미리보기예요. 실제 AI 연결과 요청은 실행하지 않아요.</AiCaption>
    </SettingsPage>
    {pages.map((page, index) => <SwipeBackModal key={`${index}-${page}`} onClose={() => {Keyboard.dismiss(); setPages(old => old.slice(0, index));}} active={index === pages.length - 1 && sheet === null}>{close => <KeyboardAvoidingView style={{flex: 1}} behavior="padding"><SettingsPage title={pageNames[page]} onBack={close}>
      {page === 'connection' && connectionPage(close)}
      {page === 'model' && modelPage(close)}
      {page === 'appPreset' && appPresetPage()}
      {page === 'modelPreset' && modelPresetPage()}
      {page === 'reasoning' && reasoningPage()}
      {page === 'response' && responsePage()}
      {page === 'tools' && toolsPage()}
      {page === 'advanced' && advancedPage()}
    </SettingsPage></KeyboardAvoidingView>}</SwipeBackModal>)}
    {sheet && <SettingsSheet title={sheet.kind === 'services' ? '프로바이더' : sheet.title} {...(sheet.kind === 'choices' && sheet.caption ? {caption: sheet.caption} : {})} onClose={() => setSheet(null)}>{close => sheet.kind === 'services' ? <>
      {aiServices.map(item => <SettingsChoice key={item.id} label={item.name} detail={item.detail} selected={service.id === item.id} onPress={() => {
        onChange(old => ({...old, service: item.id, connections: {...old.connections, [item.id]: old.connections[item.id] ?? createConnectionPreview(item)}}));
        setNotice(''); close();
      }}/>)}
    </> : <>{sheet.choices.map(item => <SettingsChoice key={item.value} label={item.label} {...(item.detail ? {detail: item.detail} : {})} selected={sheet.value === item.value} onPress={() => {sheet.choose(item.value); close();}}/>)}</>}</SettingsSheet>}
  </>}</SwipeBackModal>;
}
