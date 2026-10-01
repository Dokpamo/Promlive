import {useEffect, useState, useSyncExternalStore} from 'react';
import {aiServices, chooseConnectionRoute, chooseMediaModel, choosePreviewModel, connectionRoute, connectionRoutes,
  dataPolicyLabels, effortLabels, filterLabels, lengthLabels, modelPresetCapabilities, modelPresetFor, previewModel,
  routingLabels, safetyCategories, toolLabels, type AiConnectionPreview, type AiModelPresetPreview, type AiService,
  type AiModelPreview} from '../../features/settings/aiSettingsModel';
import {catalogKinds, catalogLabels, defaultCatalog, loadAiModels, reconcileCatalog} from '../../features/settings/aiModelCatalog';
import {catalogScope} from '../../features/settings/aiCatalogCache';
import type {AiCatalogKind} from '../../ports/aiCatalog';
import type {SettingsServices} from './SettingsServices';
import {ChoicePage, choicesFrom, Field, Note, Section, SettingRow, SettingsPage, SettingToggle, TextAction, type Choice, type SettingsNavigation} from './controls';

export function AiSettings({services, nav}: {services: SettingsServices; nav: SettingsNavigation}) {
  const {value, ready, error} = useSyncExternalStore(services.ai.subscribe, services.ai.snapshot);
  const service = aiServices.find(item => item.id === value.service)!;
  const connection = value.connections[service.id], route = connectionRoute(service, connection);
  const model = previewModel(service, connection.model, connection), preset = modelPresetFor(service.id, connection);
  const capabilities = modelPresetCapabilities(service, connection);
  const patch = (change: Partial<AiConnectionPreview>) => services.ai.update(old => ({...old, connections: {...old.connections, [service.id]: {...old.connections[service.id], ...change}}}));
  const patchPreset = (change: Partial<AiModelPresetPreview>) => services.ai.update(old => {
    const previous = old.connections[service.id];
    return {...old, connections: {...old.connections, [service.id]: {...previous, modelPresets: {...previous.modelPresets,
      [connection.model]: {...modelPresetFor(service.id, {...previous, model: connection.model}), ...change}}}}};
  });
  const select = (title: string, selected: string, choices: Choice[], choose: (next: string) => void, detail?: string) =>
    nav.push(child => <ChoicePage nav={child} title={title} value={selected} choices={choices} onChoose={choose} {...(detail ? {detail} : {})}/>);
  const row = (label: string, key: keyof AiModelPresetPreview, labels: Record<string, string>) =>
    <SettingRow label={label} value={labels[String(preset[key])] ?? String(preset[key])} onPress={() => select(label, String(preset[key]), choicesFrom(labels), next => patchPreset({[key]: next}))}/>;
  const openModels = (kind: AiCatalogKind) => nav.push(child => <ModelSelection services={services} nav={child} serviceId={service.id} kind={kind}/>);
  const field = (label: string, key: 'maxTokens' | 'temperature' | 'topP' | 'stop' | 'hosts' | 'inputPrice' | 'outputPrice' | 'context', numeric = false) =>
    <Field label={label} testID={`ui-ai-${key}`} value={preset[key]} onChange={next => patchPreset({[key]: next})} placeholder="모델 기본값"
      {...(numeric ? {keyboardType: key === 'maxTokens' || key === 'context' ? 'number-pad' as const : 'decimal-pad' as const} : {})}/>;
  return <SettingsPage title="AI" nav={nav} testID="ui-ai-settings">
    {!!error && <Note error>{error}</Note>}
    {!ready ? <Note>저장한 설정을 불러오고 있어요.</Note> : <>
      <SettingRow testID="ui-ai-provider" label="프로바이더" value={service.name} onPress={() => select('프로바이더', service.id,
        aiServices.map(item => ({value: item.id, label: item.name})), next => services.ai.update(old => ({...old, service: next as AiService})))}/>
      {connectionRoutes(service).length > 1 && <SettingRow testID="ui-ai-route" label="연결 방식" value={route.name} onPress={() => select('연결 방식', route.id,
        connectionRoutes(service).map(item => ({value: item.id, label: item.name, ...(item.auth === 'oauth' ? {detail: '로그인 연동 준비 중'} : {})})),
        next => services.ai.update(old => ({...old, connections: {...old.connections, [service.id]: chooseConnectionRoute(service, old.connections[service.id], next)}})))}/>}
      {(route.auth === 'apiKey' || route.auth === 'optionalKey') && <Field key={`${service.id}:${route.id}`} testID="ui-ai-api-key" label={route.auth === 'optionalKey' ? 'API 키 · 선택' : 'API 키'}
        secret scale={nav.scale} value={connection.key} onChange={key => patch({key})} placeholder="API 키 입력" autoComplete="off" textContentType="none"/>}
      {route.auth === 'oauth' && <Note>계정 로그인 연동은 준비 중이에요. API 키 방식으로 연결할 수 있어요.</Note>}
      {route.projectRequired && <Field label={service.id === 'qwen' ? '워크스페이스 ID' : '프로젝트 ID'} value={connection.project} onChange={project => patch({project})}/>}
      {(service.id === 'custom' || service.id === 'ollama') && <Field label="서버 주소" testID="ui-ai-url" value={connection.url} onChange={url => patch({url, catalogModel: null})} keyboardType="url" placeholder={route.url || 'https://example.com/v1'}/>}
      {service.id === 'custom' && <SettingRow label="API 형식" value={connection.protocol === 'chat' ? 'Chat Completions' : 'Responses'} onPress={() => select('API 형식', connection.protocol,
        choicesFrom({chat: 'Chat Completions', responses: 'Responses'}), protocol => patch({protocol}))}/>}
      <Section>모델 설정</Section>
      <SettingRow testID="ui-ai-model" label="대화 모델" value={model.name} onPress={() => openModels('chat')}/>
      {model.thinking && row('생각 모드', 'thinking', {default: 'API 기본값', enabled: service.id === 'anthropic' || model.adaptiveThinking ? '적응형' : '사용', disabled: '사용 안 함'})}
      {capabilities.efforts.length > 0 && row('추론 레벨', 'effort', Object.fromEntries(['default', ...capabilities.efforts].map(key => [key, effortLabels[key] ?? key])))}
      {model.verbosity && row('답변 상세도', 'verbosity', {default: 'API 기본값', low: '낮음', medium: '보통', high: '높음'})}
      {capabilities.output && field('최대 생성 토큰', 'maxTokens', true)}
      <SettingRow label="답변 길이" value={lengthLabels[value.appPreset.length] ?? '지정 안 함'} onPress={() => select('답변 길이', value.appPreset.length, choicesFrom(lengthLabels),
        length => services.ai.update(old => ({...old, appPreset: {...old.appPreset, length}})), '최대 생성 토큰과 별개의 대화 지침이에요. 답변 적용은 준비 중이에요.')}/>
      {capabilities.tools && <><Section>사용할 도구</Section>{model.tools.map(tool => <SettingToggle key={tool} testID={`ui-ai-tool-${tool}`} label={toolLabels[tool].name} value={preset.tools.includes(tool)}
        onChange={enabled => patchPreset({tools: enabled ? [...new Set([...preset.tools, tool])] : preset.tools.filter(item => item !== tool)})}/>)}</>}
      {catalogKinds(service, connection).some(kind => kind !== 'chat') && <><Section>이미지·영상·음성</Section>
        {catalogKinds(service, connection).filter(kind => kind !== 'chat').map(kind => <SettingRow key={kind} label={catalogLabels[kind]}
          value={kind === 'voice' ? connection.media.voiceName || connection.media.voice || '선택 안 함' : defaultCatalog(service, connection, kind).find(item => item.id === connection.media[kind])?.name || connection.media[kind] || '선택 안 함'} onPress={() => openModels(kind)}/>)}</>}
      {capabilities.sampling && <><Section>생성 옵션</Section>{field('Temperature', 'temperature', true)}{service.id !== 'deepseek' && field('Top P', 'topP', true)}{capabilities.stop && field('중단 문자열', 'stop')}</>}
      {capabilities.reasoningTopP && <><Section>추론 생성 옵션</Section>{field('Top P', 'topP', true)}<Note>생각 모드에서는 0.95–1.0 범위를 사용해요.</Note></>}
      {capabilities.routing && <><Section>처리 업체와 라우팅</Section>{row('우선순위', 'routing', routingLabels)}
        <SettingToggle label="다른 업체로 전환" value={preset.fallback} onChange={fallback => patchPreset({fallback})}/>
        {row('데이터 정책', 'dataPolicy', dataPolicyLabels)}{field('처리 업체 지정 · 선택', 'hosts')}{field('입력 · 100만 토큰당 달러', 'inputPrice', true)}{field('출력 · 100만 토큰당 달러', 'outputPrice', true)}</>}
      {capabilities.filters && <><Section>콘텐츠 필터</Section>{Object.entries(safetyCategories).map(([key, label]) => <SettingRow key={key} label={label} value={filterLabels[preset.filters[key] ?? 'default'] ?? '서비스 기본값'}
        onPress={() => select(label, preset.filters[key] ?? 'default', choicesFrom(filterLabels), next => patchPreset({filters: {...preset.filters, [key]: next}}))}/>)}</>}
      {capabilities.localRuntime && <><Section>로컬 모델</Section>{field('컨텍스트 크기', 'context', true)}{row('메모리에 유지', 'keepAlive', {default: '서버 기본값', '0': '바로 해제', '5m': '5분', '30m': '30분', '-1': '계속 유지'})}</>}
      <Note>설정은 기기에 저장돼요. 새 채팅의 AI 응답 연결과 도구·생성 옵션의 답변 적용은 준비 중이에요.</Note>
    </>}
  </SettingsPage>;
}

function ModelSelection({services, nav, serviceId, kind}: {services: SettingsServices; nav: SettingsNavigation; serviceId: AiService; kind: AiCatalogKind}) {
  const {value} = useSyncExternalStore(services.ai.subscribe, services.ai.snapshot);
  const service = aiServices.find(item => item.id === serviceId)!, connection = value.connections[serviceId];
  const scope = catalogScope(service, connection, kind);
  return <ModelSession key={scope} services={services} nav={nav} serviceId={serviceId} kind={kind} connection={connection} scope={scope}/>;
}
function ModelSession({services, nav, serviceId, kind, connection, scope}: {services: SettingsServices; nav: SettingsNavigation; serviceId: AiService; kind: AiCatalogKind; connection: AiConnectionPreview; scope: string}) {
  const service = aiServices.find(item => item.id === serviceId)!;
  const [models, setModels] = useState(() => services.catalogs.get(scope)?.models ?? defaultCatalog(service, connection, kind));
  const [query, setQuery] = useState(''), [manual, setManual] = useState(connection.model);
  const [state, setState] = useState(''), [attempt, setAttempt] = useState(0);
  const selected = kind === 'chat' ? connection.model : connection.media[kind];
  useEffect(() => {
    const abort = new AbortController();
    const route = connectionRoute(service, connection);
    if (route.auth === 'oauth') {setState('계정 연결 후 목록을 확인할 수 있어요.'); return;}
    if (route.auth === 'apiKey' && !connection.key.trim()) {setState('API 키를 입력하면 계정의 최신 목록을 확인할 수 있어요.'); return;}
    setState('모델 목록 갱신 중');
    void services.catalogs.refresh(scope, async signal => reconcileCatalog(models, await loadAiModels(service, connection, signal, kind)), abort.signal).then(next => {
      if (abort.signal.aborted) return;
      setModels(next); setState(next.length ? '' : '이 목록에는 사용할 수 있는 모델이 없어요.');
    }).catch(() => {if (!abort.signal.aborted) setState('목록을 갱신하지 못했어요. 저장한 목록을 표시해요.');});
    return () => abort.abort();
    // The parent keys this session by provider, route, endpoint and credentials.
  }, [scope, services, attempt]);
  const choose = (model: AiModelPreview) => {
    services.ai.update(old => ({...old, connections: {...old.connections, [serviceId]: kind === 'chat'
      ? choosePreviewModel(serviceId, old.connections[serviceId], model) : chooseMediaModel(old.connections[serviceId], kind, model)}}));
    nav.back();
  };
  return <SettingsPage nav={nav} title={catalogLabels[kind]} testID="ui-model-selection" action={<TextAction label="새로고침" onPress={() => setAttempt(value => value + 1)}/>}>
    <Field label="모델 검색" value={query} onChange={setQuery} placeholder="이름 또는 모델 ID" testID="ui-model-search"/>
    {!!state && <Note>{state}</Note>}
    {kind !== 'chat' && <SettingRow label="선택 안 함" value={!selected ? '선택됨' : ''} onPress={() => choose({id: '', name: '', detail: '', effort: [], tools: []})}/>}
    {models.filter(model => `${model.name} ${model.id}`.toLowerCase().includes(query.trim().toLowerCase())).map(model =>
      <SettingRow key={model.id} testID={`ui-model-${model.id}`} label={model.name} value={selected === model.id ? '선택됨' : ''} selected={selected === model.id} onPress={() => choose(model)}/>)}
    {kind === 'chat' && ['custom', 'ollama'].includes(serviceId) && <><Field label="모델 ID 직접 입력" value={manual} onChange={setManual} testID="ui-ai-manual-model"/>
      <TextAction label="이 모델 사용" disabled={!manual.trim()} onPress={() => choose({id: manual.trim(), name: manual.trim(), detail: '직접 입력한 모델', effort: [], tools: []})}/></>}
  </SettingsPage>;
}
