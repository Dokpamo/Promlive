/** API catalogs are versioned against official sources in aiOfficialCatalog. */
import {officialModels} from './aiOfficialCatalog';
export type AiService = 'openai' | 'anthropic' | 'google' | 'xai' | 'deepseek' | 'openrouter' | 'minimax' | 'xiaomi' | 'qwen' | 'zai' | 'kimi' | 'ollama' | 'custom';
export type AiTool = 'web' | 'x' | 'files' | 'code';
export type AiModelPreview = import('zod').infer<typeof import('./aiModelSchema').aiModelSchema>;
export interface AiConnectionRoute {
  id: string; name: string; detail: string; url: string;
  auth: 'apiKey' | 'oauth' | 'local' | 'optionalKey';
  /** Omitted: official API catalog; empty: discover the account catalog after login. */
  models?: AiModelPreview[];
  loginLabel?: string;
  projectRequired?: boolean;
}
export interface AiServicePreview {
  id: AiService; name: string; mark: string; detail: string; url: string;
  models: AiModelPreview[];
  routes?: AiConnectionRoute[];
}
// OAuth routes are UI previews until their login adapters are implemented.
// Consumer account logins without a documented API authorization route are not offered.
export const aiServices: AiServicePreview[] = [
  {id: 'openai', name: 'OpenAI', mark: 'O', detail: 'GPT 모델', url: 'https://api.openai.com/v1', models: officialModels('openai', 'chat'), routes: [
    {id: 'api', name: 'API 키', detail: 'OpenAI API 계정으로 연결해요.', auth: 'apiKey', url: 'https://api.openai.com/v1'},
    {id: 'codex', name: 'ChatGPT 계정', detail: 'Codex 연결 · 로그인 연동 준비 중', auth: 'oauth', url: 'https://chatgpt.com/backend-api/codex', models: [], loginLabel: 'ChatGPT로 로그인'},
  ]},
  {id: 'anthropic', name: 'Anthropic', mark: 'A', detail: 'Claude 모델 · API 키', url: 'https://api.anthropic.com', models: officialModels('anthropic', 'chat')},
  {id: 'google', name: 'Google', mark: 'G', detail: 'Gemini 모델', url: 'https://generativelanguage.googleapis.com', models: officialModels('google', 'chat'), routes: [
    {id: 'api', name: 'API 키', detail: 'Google AI Studio에서 발급한 키를 사용해요.', auth: 'apiKey', url: 'https://generativelanguage.googleapis.com'},
    {id: 'oauth', name: 'Google Cloud 계정', detail: 'Cloud 프로젝트 권한 · 로그인 연동 준비 중', auth: 'oauth', url: 'https://generativelanguage.googleapis.com', models: [], loginLabel: 'Google로 로그인', projectRequired: true},
  ]},
  // Account-login preview follows https://hermes-agent.nousresearch.com/docs/guides/xai-grok-oauth.
  {id: 'xai', name: 'xAI', mark: 'x', detail: 'Grok 모델 · 웹과 X 검색', url: 'https://api.x.ai/v1', models: officialModels('xai', 'chat'), routes: [
    {id: 'api', name: 'API 키', detail: 'xAI API 계정으로 연결해요.', auth: 'apiKey', url: 'https://api.x.ai/v1'},
    {id: 'oauth', name: 'Grok 계정', detail: '로그인 연동 준비 중', auth: 'oauth', url: 'https://api.x.ai/v1', models: [], loginLabel: 'Grok으로 로그인'},
  ]},
  {id: 'deepseek', name: 'DeepSeek', mark: 'D', detail: '생각 모드를 전환하는 대화', url: 'https://api.deepseek.com', models: officialModels('deepseek', 'chat')},
  {id: 'openrouter', name: 'OpenRouter', mark: 'R', detail: '여러 회사의 모델을 한곳에서', url: 'https://openrouter.ai/api/v1', models: officialModels('openrouter', 'chat'), routes: [
    {id: 'api', name: 'API 키', detail: 'OpenRouter에서 발급한 키를 사용해요.', auth: 'apiKey', url: 'https://openrouter.ai/api/v1'},
    {id: 'oauth', name: 'OpenRouter 계정', detail: '앱 연결 승인 · 로그인 연동 준비 중', auth: 'oauth', url: 'https://openrouter.ai/api/v1', loginLabel: 'OpenRouter로 로그인'},
  ]},
  {id: 'minimax', name: 'MiniMax', mark: 'M', detail: 'MiniMax 모델 · API 키', url: 'https://api.minimax.io/v1', models: officialModels('minimax', 'chat'), routes: [
    {id: 'api', name: 'API 키 · 글로벌', detail: 'MiniMax 글로벌 플랫폼에서 발급한 키', auth: 'apiKey', url: 'https://api.minimax.io/v1'},
    {id: 'api-cn', name: 'API 키 · 중국', detail: '중국 플랫폼에서 발급한 키를 별도로 사용해요.', auth: 'apiKey', url: 'https://api.minimaxi.com/v1'},
  ]},
  {id: 'xiaomi', name: 'Xiaomi', mark: 'Mi', detail: '샤오미 MiMo 모델 · API 키', url: 'https://api.xiaomimimo.com/v1', models: officialModels('xiaomi', 'chat')},
  {id: 'qwen', name: 'Alibaba Cloud', mark: 'A', detail: 'Alibaba Cloud Model Studio · API 키', url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', models: officialModels('qwen', 'chat'), routes: [
    {id: 'api', name: 'API 키 · 싱가포르', detail: 'Alibaba Cloud Model Studio에서 발급한 키', auth: 'apiKey', url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'},
    {id: 'api-cn', name: 'API 키 · 중국', detail: '중국 리전의 API 키와 워크스페이스 ID를 사용해요.', auth: 'apiKey', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', projectRequired: true},
  ]},
  {id: 'zai', name: 'Z.AI', mark: 'Z', detail: 'GLM 모델 · API 키', url: 'https://api.z.ai/api/paas/v4', models: officialModels('zai', 'chat')},
  {id: 'kimi', name: 'Moonshot AI', mark: 'M', detail: 'Kimi 모델 · API 키', url: 'https://api.moonshot.ai/v1', models: officialModels('kimi', 'chat'), routes: [
    {id: 'api', name: 'API 키 · 글로벌', detail: 'Moonshot 글로벌 플랫폼에서 발급한 키', auth: 'apiKey', url: 'https://api.moonshot.ai/v1'},
    {id: 'api-cn', name: 'API 키 · 중국', detail: '중국 플랫폼에서 발급한 키를 별도로 사용해요.', auth: 'apiKey', url: 'https://api.moonshot.cn/v1'},
  ]},
  {id: 'ollama', name: 'Ollama', mark: 'O', detail: '내 컴퓨터 또는 Ollama Cloud', url: 'http://localhost:11434', models: [], routes: [
    {id: 'local', name: '내 컴퓨터', detail: 'Ollama가 실행 중인 컴퓨터에 연결해요.', auth: 'local', url: 'http://localhost:11434'},
    {id: 'cloud', name: 'Ollama Cloud', detail: 'Ollama API 키로 클라우드 모델을 사용해요.', auth: 'apiKey', url: 'https://ollama.com'},
  ]},
  {id: 'custom', name: '직접 연결', mark: '+', detail: '호환 API의 주소를 직접 입력', url: '', models: []},
];

export interface AiConnectionProfile {
  name: string; key: string; url: string; model: string; ollamaMode: string; protocol: string; project: string;
  modelPresets: Record<string, AiModelPresetPreview>;
  catalogModel: AiModelPreview | null;
  media: {image: string; video: string; audio: string; voice: string; voiceName: string};
}
export interface AiConnectionPreview extends AiConnectionProfile {
  routeId: string;
  routes: Record<string, AiConnectionProfile>;
}
/** App instructions are shared across providers and never become API parameter values. */
export interface AiAppPresetPreview {
  length: string;
}
/** API options only. Connection credentials and app instructions live separately. */
export interface AiModelPresetPreview {
  effort: string; thinking: string; verbosity: string; maxTokens: string;
  temperature: string; topP: string; stop: string; tools: AiTool[];
  routing: string; hosts: string; fallback: boolean; dataPolicy: string;
  inputPrice: string; outputPrice: string;
  context: string; keepAlive: string;
  filters: Record<string, string>;
}
export interface AiSettingsPreviewState {
  service: AiService;
  appPreset: AiAppPresetPreview;
  connections: Record<AiService, AiConnectionPreview>;
}

export function createModelPreset(service: AiService): AiModelPresetPreview {
  return {
    effort: 'default', thinking: 'default', verbosity: 'default', maxTokens: service === 'anthropic' ? '4096' : '',
    temperature: '', topP: '', stop: '', tools: [], routing: 'auto', hosts: '', fallback: true,
    dataPolicy: 'default', inputPrice: '', outputPrice: '', context: '', keepAlive: 'default',
    filters: {harassment: 'default', hate: 'default', sexual: 'default', dangerous: 'default'},
  };
}

export function createAiSettingsPreview(): AiSettingsPreviewState {
  const connections = {} as Record<AiService, AiConnectionPreview>;
  for (const service of aiServices) {
    connections[service.id] = createConnectionPreview(service);
  }
  return {service: 'xai', appPreset: {length: 'default'}, connections};
}

export function createConnectionPreview(service: AiServicePreview): AiConnectionPreview {
  const route = connectionRoutes(service)[0]!;
  return {...createConnectionProfile(service, route), routeId: route.id, routes: {}};
}

export function connectionRoutes(service: AiServicePreview): AiConnectionRoute[] {
  return service.routes ?? [{id: 'api', name: 'API 키', detail: '프로바이더에서 발급한 키로 연결해요.', auth: service.id === 'custom' ? 'optionalKey' : 'apiKey', url: service.url}];
}

export function connectionRoute(service: AiServicePreview, connection: AiConnectionPreview): AiConnectionRoute {
  return connectionRoutes(service).find(route => route.id === connection.routeId) ?? connectionRoutes(service)[0]!;
}

function createConnectionProfile(service: AiServicePreview, route: AiConnectionRoute): AiConnectionProfile {
  const model = (route.models ?? service.models)[0]?.id ?? '';
  return {name: service.name, key: '', url: route.url, model, project: '', ollamaMode: route.id === 'cloud' ? 'cloud' : 'local', protocol: 'chat', modelPresets: {[model]: createModelPreset(service.id)}, catalogModel: null, media: {image: '', video: '', audio: '', voice: '', voiceName: ''}};
}

/** Different endpoints/accounts must not inherit another route's credentials or model settings. */
export function chooseConnectionRoute(service: AiServicePreview, connection: AiConnectionPreview, id: string): AiConnectionPreview {
  const route = connectionRoutes(service).find(item => item.id === id);
  if (!route || connectionRoute(service, connection).id === id) return connection;
  const {routes, routeId: _routeId, ...current} = connection;
  const saved = {...routes, [connectionRoute(service, connection).id]: current};
  return {...(saved[id] ?? createConnectionProfile(service, route)), routeId: id, routes: saved};
}

export function connectionModels(service: AiServicePreview, connection?: AiConnectionPreview): AiModelPreview[] {
  return connection ? connectionRoute(service, connection).models ?? service.models : service.models;
}

export const effortLabels: Record<string, string> = {default: 'API 기본값', none: '사용 안 함', minimal: '최소', low: '낮음', medium: '보통', high: '높음', xhigh: '매우 높음', max: '최대'};
export const lengthLabels: Record<string, string> = {default: '지정 안 함', short: '간결하게', balanced: '균형 있게', long: '자세하게'};
export const routingLabels: Record<string, string> = {auto: '자동', price: '가격 우선', latency: '응답 시작 속도', throughput: '생성 속도'};
export const dataPolicyLabels: Record<string, string> = {default: '계정 기본값', deny: '데이터 수집 업체 제외', zdr: '데이터 미보관 업체만'};
export const filterLabels: Record<string, string> = {default: '서비스 기본값', high: '높은 위험만 차단', medium: '중간 이상 차단', low: '낮은 위험부터 차단'};
export const safetyCategories: Record<string, string> = {harassment: '괴롭힘', hate: '혐오 표현', sexual: '성적 콘텐츠', dangerous: '위험한 콘텐츠'};
export const toolLabels: Record<AiTool, {name: string; detail: string}> = {
  web: {name: '웹 검색', detail: '웹에서 최신 정보를 찾아 답변해요.'},
  x: {name: 'X 검색', detail: 'X 게시물과 대화를 검색해요.'},
  files: {name: '파일 검색', detail: '연결한 파일에서 내용을 찾아요.'},
  code: {name: '코드 실행', detail: '계산과 데이터 분석에 사용해요.'},
};

export function previewModel(service: AiServicePreview, id: string, connection?: AiConnectionPreview): AiModelPreview {
  const documented = connectionModels(service, connection).find(model => model.id === id);
  if (connection?.catalogModel?.id === id) return {...documented, ...connection.catalogModel};
  return documented ?? {id, name: id || '모델 선택', detail: '직접 입력한 모델', effort: [], tools: []};
}

export function modelPresetFor(service: AiService, connection: AiConnectionPreview): AiModelPresetPreview {
  const saved = connection.modelPresets[connection.model] ?? createModelPreset(service);
  const model = previewModel(aiServices.find(item => item.id === service)!, connection.model, connection);
  return {...saved, effort: resolveEffort(service, model, saved)};
}

function availableEfforts(service: AiService, model: AiModelPreview, thinking: string) {
  return model.effort.filter(effort => {
    if (model.effortNeedsThinking && thinking === 'disabled') return false;
    return !(service === 'anthropic' && model.id === 'claude-opus-5' && thinking === 'disabled' && ['xhigh', 'max'].includes(effort));
  });
}

/** Legacy/default preferences resolve only to a documented or server-provided level. */
function resolveEffort(service: AiService, model: AiModelPreview, saved: AiModelPresetPreview) {
  const efforts = availableEfforts(service, model, saved.thinking);
  if (efforts.includes(saved.effort)) return saved.effort;
  return model.defaultEffort && efforts.includes(model.defaultEffort) ? model.defaultEffort : 'default';
}

export function choosePreviewModel(service: AiService, connection: AiConnectionPreview, model: AiModelPreview): AiConnectionPreview {
  const saved = connection.modelPresets[model.id] ?? createModelPreset(service);
  const resolved = previewModel(aiServices.find(item => item.id === service)!, model.id, {...connection, catalogModel: model});
  const preset = {...saved, effort: resolveEffort(service, resolved, saved), tools: saved.tools.filter(tool => model.tools.includes(tool))};
  return {...connection, model: model.id, catalogModel: model.source === 'api' ? model : null, modelPresets: {...connection.modelPresets, [model.id]: preset}};
}

export function chooseMediaModel(connection: AiConnectionPreview, kind: 'image' | 'video' | 'audio' | 'voice', model: AiModelPreview): AiConnectionPreview {
  return {...connection, media: {...connection.media, [kind]: model.id, ...(kind === 'voice' ? {voiceName: model.name} : {})}};
}

export function modelPresetCapabilities(service: AiServicePreview, connection: AiConnectionPreview) {
  const model = previewModel(service, connection.model, connection);
  const preset = modelPresetFor(service.id, connection);
  const known = model.source === 'api' || connectionModels(service, connection).some(item => item.id === model.id);
  const thinkingOff = preset.thinking === 'disabled';
  const efforts = availableEfforts(service.id, model, preset.thinking);
  const sampling = !!model.sampling && (!model.samplingWithoutThinking || thinkingOff);
  const reasoningTopP = known && service.id === 'deepseek' && !thinkingOff;
  const routing = service.id === 'openrouter';
  const filters = known && service.id === 'google';
  const localRuntime = service.id === 'ollama' && connection.ollamaMode === 'local';
  return {
    efforts, reasoning: model.effort.length > 0 || !!model.thinking,
    output: known, tools: model.tools.length > 0,
    advanced: sampling || reasoningTopP || routing || filters || localRuntime,
    sampling, stop: sampling && !!model.stop, reasoningTopP, routing, filters, localRuntime,
  };
}
