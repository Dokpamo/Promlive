import {useState, type Dispatch, type SetStateAction} from 'react';
import {Keyboard} from 'react-native';
import {SettingsChoice, SettingsGroup, SettingsPage, SettingsRow, SettingsSheet} from './SettingsLayout';
import {SwipeBackModal} from '../../layout/SwipeBackModal';
import {AiAction, AiCaption, AiField, AiSection, AiToggle} from './AiSettingsControls';
import {AiModelSelectionSheet} from './AiModelSelectionSheet';
import {aiChoiceCaptions, providerCaption} from './aiSheetCaptions';
import {useSettingsSheetState} from './useSettingsSheetState';
import {catalogKinds, catalogLabels} from './aiModelCatalog';
import type {AiCatalogKind} from '../../ports/aiCatalog';
import {outputLimitValue} from './aiOutputLimit';
import {aiServices, chooseConnectionRoute, chooseMediaModel, choosePreviewModel, connectionRoute, connectionRoutes, createConnectionPreview, dataPolicyLabels, effortLabels, filterLabels, lengthLabels, modelPresetCapabilities, modelPresetFor, previewModel, routingLabels, safetyCategories, toolLabels, type AiConnectionPreview, type AiModelPresetPreview, type AiSettingsPreviewState} from './aiSettingsModel';

type StringSetting<T> = {[K in keyof T]: T[K] extends string ? K : never}[keyof T];
type Choice = {value: string; label: string; detail?: string};
type Sheet = {kind: 'services'} | {kind: 'models'; catalog: AiCatalogKind} | {kind: 'choices'; title: string; caption?: string; value: string; choices: Choice[]; choose: (value: string) => void};
const choicesFrom = (labels: Record<string, string>): Choice[] => Object.entries(labels).map(([value, label]) => ({value, label}));
const verbosityLabels: Record<string, string> = {default: 'API 기본값', low: '낮음', medium: '보통', high: '높음'};

/** Preferences apply immediately; catalogs refresh on opening. Inference and OAuth remain disconnected. */
export function AiSettingsPreview({value, onChange, onClose, saveError = ''}: {
  value: AiSettingsPreviewState; onChange: Dispatch<SetStateAction<AiSettingsPreviewState>>; onClose: () => void; saveError?: string;
}) {
  const service = aiServices.find(item => item.id === value.service)!;
  const connection = value.connections[value.service];
  const route = connectionRoute(service, connection);
  const liveCatalog = route.auth !== 'oauth' && service.id !== 'zai';
  const mediaKinds = catalogKinds(service, connection).filter(kind => kind !== 'chat');
  const routes = connectionRoutes(service);
  const model = previewModel(service, connection.model, connection);
  const preset = modelPresetFor(service.id, connection);
  const capabilities = modelPresetCapabilities(service, connection);
  const {sheet, sheetKey, setSheet, closeSheet} = useSettingsSheetState<Sheet>();
  const [notice, setNotice] = useState('');
  const patch = (change: Partial<AiConnectionPreview>) => onChange(old => ({...old, connections: {...old.connections, [service.id]: {...old.connections[service.id], ...change}}}));
  const patchPreset = (change: Partial<AiModelPresetPreview>) => onChange(old => {
    const previous = old.connections[service.id];
    return {...old, connections: {...old.connections, [service.id]: {...previous, modelPresets: {...previous.modelPresets, [connection.model]: {...modelPresetFor(service.id, {...previous, model: connection.model}), ...change}}}}};
  });
  const select = (title: string, selected: string, choices: Choice[], choose: (next: string) => void, caption?: string) => {
    Keyboard.dismiss();
    const description = caption ?? aiChoiceCaptions[title];
    setSheet({kind: 'choices', title, value: selected, choices, choose, ...(description ? {caption: description} : {})});
  };
  const connectionField = (label: string, key: StringSetting<AiConnectionPreview>, placeholder: string, detail?: string) => <AiField label={label} value={connection[key]} onChange={next => patch({[key]: next, ...(key === 'url' ? {catalogModel: null} : {})})} placeholder={placeholder} {...(key === 'url' ? {editor: 'mini' as const, keyboard: 'url' as const, ...(route.url ? {resetValue: route.url} : {})} : {})} {...(detail ? {detail} : {})}/>;
  const field = (label: string, key: StringSetting<AiModelPresetPreview>, placeholder: string, detail?: string, numeric = false) => <AiField label={label} value={preset[key]} onChange={next => patchPreset({[key]: next})} placeholder={placeholder} editor={key === 'maxTokens' ? 'mini' : 'full'} {...(detail ? {detail} : {})} {...(numeric ? {keyboard: key === 'maxTokens' ? 'number-pad' as const : 'decimal-pad' as const} : {})}/>;
  const thinkingOff = preset.thinking === 'disabled';
  const adaptiveThinking = service.id === 'anthropic' || model.adaptiveThinking;
  const hasOptions = capabilities.reasoning || capabilities.output || capabilities.tools || capabilities.advanced;
  const openCatalog = (catalog: AiCatalogKind) => {Keyboard.dismiss(); setSheet({kind: 'models', catalog});};

  function advancedOptions() {
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
        <SettingsGroup>{Object.entries(safetyCategories).map(([key, label]) => <SettingsRow key={key} label={label} value={filterLabels[preset.filters[key] ?? 'default'] ?? '서비스 기본값'} onPress={() => select(label, preset.filters[key] ?? 'default', choicesFrom(filterLabels), next => patchPreset({filters: {...preset.filters, [key]: next}}), '이 유형의 콘텐츠를 차단할 기준을 선택해요.')}/>)}</SettingsGroup>
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

  return <SwipeBackModal onClose={onClose}>{back => <>
    <SettingsPage title="AI" titleInHeader onBack={back} obscured={sheet !== null}>
      {saveError && <AiCaption>{saveError}</AiCaption>}
      <SettingsGroup>
        <SettingsRow label="프로바이더" value={service.name} onPress={() => {Keyboard.dismiss(); setSheet({kind: 'services'});}}/>
        {routes.length > 1 && <SettingsRow label="연결 방식" value={route.name} onPress={() => select('연결 방식', route.id, routes.map(item => ({value: item.id, label: item.name})), id => {
          onChange(old => ({...old, connections: {...old.connections, [service.id]: chooseConnectionRoute(service, old.connections[service.id], id)}}));
          setNotice('');
        })}/>}
      </SettingsGroup>
      {(route.auth === 'apiKey' || route.auth === 'optionalKey') && <AiField key={`${service.id}-${route.id}`} label={route.auth === 'optionalKey' ? 'API 키 · 선택' : 'API 키'} secret editor="mini" value={connection.key} onChange={key => patch({key})} placeholder="API 키를 입력해 주세요"/>}
      {service.id === 'qwen' && route.projectRequired && connectionField('워크스페이스 ID', 'project', 'Model Studio 워크스페이스 ID', '중국 리전의 모델 목록을 조회할 때 사용해요.')}
      {route.auth === 'oauth' && <>
        {route.projectRequired && connectionField('Google Cloud 프로젝트 ID', 'project', '프로젝트 ID', 'Cloud 프로젝트의 API 권한으로 연결해요.')}
        <AiAction label={route.loginLabel ?? '계정으로 로그인'} primary onPress={() => setNotice('지금은 로그인 화면 미리보기예요. 실제 연결은 아직 실행하지 않아요.')}/>
        <AiCaption>{notice || '로그인 연동은 준비 중이에요. 현재는 API 키로 모델 목록을 조회할 수 있어요.'}</AiCaption>
      </>}
      {(service.id === 'ollama' || service.id === 'custom') && connectionField('서버 주소', 'url', service.id === 'ollama' ? 'http://192.168.0.10:11434' : 'https://example.com/v1', service.id === 'ollama' && connection.ollamaMode === 'local' ? '모델을 실행하는 컴퓨터의 주소를 입력해 주세요.' : undefined)}
      {service.id === 'custom' && <SettingsGroup><SettingsRow label="API 형식" value={connection.protocol === 'chat' ? 'Chat Completions' : 'Responses'} onPress={() => select('API 형식', connection.protocol, [{value: 'chat', label: 'Chat Completions'}, {value: 'responses', label: 'Responses'}], next => patch({protocol: next}))}/></SettingsGroup>}

      <AiSection>모델 설정</AiSection>
      <SettingsGroup>
        <SettingsRow label={liveCatalog ? '대화 모델' : '모델'} value={model.name} onPress={() => openCatalog('chat')}/>
        {model.thinking && <SettingsRow label="생각 모드" value={preset.thinking === 'default' ? 'API 기본값' : thinkingOff ? '사용 안 함' : adaptiveThinking ? '적응형' : '사용'} onPress={() => select('생각 모드', preset.thinking, [
          {value: 'default', label: 'API 기본값'},
          {value: 'enabled', label: adaptiveThinking ? '적응형' : '사용'},
          {value: 'disabled', label: '사용 안 함'},
        ], thinking => patchPreset({thinking, effort: 'default'}))}/>}
        {capabilities.efforts.length > 0 && <SettingsRow label="추론 레벨" value={preset.effort === 'default' ? '선택' : effortLabels[preset.effort] ?? preset.effort} onPress={() => select('추론 레벨', preset.effort, capabilities.efforts.map(effort => ({value: effort, label: effortLabels[effort] ?? effort})), effort => patchPreset({effort}))}/>}
        {model.verbosity && <SettingsRow label="답변 상세도" value={verbosityLabels[preset.verbosity] ?? 'API 기본값'} onPress={() => select('답변 상세도', preset.verbosity, choicesFrom(verbosityLabels), verbosity => patchPreset({verbosity}))}/>}
      </SettingsGroup>
      {capabilities.output && field('최대 생성 토큰', 'maxTokens', outputLimitValue('', model.maxOutputTokens), model.maxOutputTokens ? `최대 ${model.maxOutputTokens.toLocaleString()} 토큰까지 지원해요.` : undefined, true)}
      {capabilities.tools && <>
        <AiSection>사용할 도구</AiSection>
        <SettingsGroup>{model.tools.map(tool => <AiToggle key={tool} label={toolLabels[tool].name} detail={toolLabels[tool].detail} value={preset.tools.includes(tool)} onChange={enabled => patchPreset({tools: enabled ? [...preset.tools, tool] : preset.tools.filter(item => item !== tool)})}/>)}</SettingsGroup>
      </>}
      {!hasOptions && <AiCaption>{connection.model ? '연결 후 이 모델이 지원하는 설정을 표시해요.' : '모델을 선택하면 사용할 수 있는 설정이 표시돼요.'}</AiCaption>}
      {advancedOptions()}

      {mediaKinds.length > 0 && <>
        <AiSection>이미지 · 영상 · 음성</AiSection>
        <SettingsGroup>{mediaKinds.map(kind => <SettingsRow key={kind} label={catalogLabels[kind]} value={(kind === 'voice' ? connection.media.voiceName : connection.media[kind]) || '선택 안 함'} onPress={() => openCatalog(kind)}/>)}</SettingsGroup>
      </>}

      <AiSection>공통 앱 프리셋</AiSection>
      <SettingsGroup><SettingsRow label="답변 길이" value={lengthLabels[value.appPreset.length] ?? '지정 안 함'} onPress={() => select('답변 길이', value.appPreset.length, choicesFrom(lengthLabels), length => onChange(old => ({...old, appPreset: {...old.appPreset, length}})), '모든 모델에 공통으로 적용하는 대화 지침이에요. 최대 생성 토큰과는 별개예요.')}/></SettingsGroup>
      {route.auth !== 'oauth' && service.id !== 'ollama' && service.id !== 'custom' && <>
        {connectionField('API 주소', 'url', route.url, service.id === 'qwen' ? 'Model Studio에 표시된 리전·워크스페이스 주소를 사용해 주세요.' : undefined)}
      </>}
    </SettingsPage>

    {sheet && sheet.kind !== 'models' && <SettingsSheet key={sheetKey} title={sheet.kind === 'services' ? '프로바이더' : sheet.title} {...(sheet.kind === 'services' ? {caption: providerCaption} : sheet.caption ? {caption: sheet.caption} : {})} onClose={closeSheet}>{close => sheet.kind === 'services' ? <>
      {aiServices.map(item => <SettingsChoice key={item.id} label={item.name} selected={service.id === item.id} onPress={() => {
        onChange(old => ({...old, service: item.id, connections: {...old.connections, [item.id]: old.connections[item.id] ?? createConnectionPreview(item)}}));
        setNotice(''); close();
      }}/>)}
    </> : <>{sheet.choices.map(item => <SettingsChoice key={item.value} label={item.label} {...(item.detail ? {detail: item.detail} : {})} selected={sheet.value === item.value} onPress={() => {sheet.choose(item.value); close();}}/>)}</>}</SettingsSheet>}
    {sheet?.kind === 'models' && <AiModelSelectionSheet key={sheetKey} service={service} connection={connection} kind={sheet.catalog} onClose={closeSheet} onRefresh={models => {
      if (sheet.catalog !== 'chat') return;
      onChange(old => {
        const current = old.connections[service.id];
        if (current.routeId !== connection.routeId || current.key !== connection.key || current.url !== connection.url) return old;
        const refreshed = models.find(item => item.id === current.model);
        return refreshed ? {...old, connections: {...old.connections, [service.id]: {...current, catalogModel: refreshed}}} : old;
      });
    }} onSelect={(next, effort) => {
      onChange(old => {
        const chosen = sheet.catalog === 'chat' ? choosePreviewModel(service.id, old.connections[service.id], next) : chooseMediaModel(old.connections[service.id], sheet.catalog, next);
        if (effort && modelPresetCapabilities(service, chosen).efforts.includes(effort)) chosen.modelPresets = {...chosen.modelPresets, [next.id]: {...modelPresetFor(service.id, chosen), effort}};
        return {...old, connections: {...old.connections, [service.id]: chosen}};
      });
    }} onManualChange={model => patch({model, catalogModel: null})}/>}
  </>}</SwipeBackModal>;
}
