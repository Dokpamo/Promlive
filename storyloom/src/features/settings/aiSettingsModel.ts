/** UI fixtures, checked against provider docs on 2026-09-21. No API discovery or credentials are persisted. */
export type AiService = 'openai' | 'anthropic' | 'google' | 'xai' | 'deepseek' | 'openrouter' | 'minimax' | 'xiaomi' | 'qwen' | 'zai' | 'kimi' | 'ollama' | 'custom';
export type AiTool = 'web' | 'x' | 'files' | 'code';
export interface AiModelPreview {
  id: string; name: string; detail: string;
  effort: string[];
  thinking?: boolean;
  adaptiveThinking?: boolean;
  effortNeedsThinking?: boolean;
  verbosity?: boolean;
  sampling?: boolean;
  samplingWithoutThinking?: boolean;
  stop?: boolean;
  tools: AiTool[];
}
export interface AiConnectionRoute {
  id: string; name: string; detail: string; url: string;
  auth: 'apiKey' | 'oauth' | 'local' | 'optionalKey';
  /** Omitted: API examples; empty: discover this account's catalog after login. */
  models?: AiModelPreview[];
  loginLabel?: string;
  projectRequired?: boolean;
}
export interface AiServicePreview {
  id: AiService; name: string; mark: string; detail: string; url: string;
  models: AiModelPreview[];
  routes?: AiConnectionRoute[];
}
const levels = ['low', 'medium', 'high'];
// Connection routes follow https://hermes-agent.nousresearch.com/docs/integrations/providers.
// OAuth entries only preview the UI; they are not production login integrations.
// Claude uses API keys here; Claude.ai consumer OAuth is not a general third-party API login.
export const aiServices: AiServicePreview[] = [
  {id: 'openai', name: 'OpenAI', mark: 'O', detail: 'GPT 모델', url: 'https://api.openai.com/v1', models: [
    {id: 'gpt-6-astra', name: 'GPT-6 Astra', detail: '깊이 있는 추론', effort: [...levels, 'xhigh', 'max'], tools: ['web', 'files', 'code']},
    {id: 'gpt-5.5', name: 'GPT-5.5', detail: '추론과 답변 상세도 조절', effort: [...levels, 'xhigh'], verbosity: true, tools: ['web', 'files', 'code']},
    {id: 'gpt-4.1', name: 'GPT-4.1', detail: '생성 옵션을 직접 조절하는 대화', effort: [], sampling: true, stop: true, tools: ['web', 'files', 'code']},
  ], routes: [
    {id: 'api', name: 'API 키', detail: 'OpenAI API 계정으로 연결해요.', auth: 'apiKey', url: 'https://api.openai.com/v1'},
    {id: 'codex', name: 'ChatGPT 계정', detail: 'Codex 연결 · API 계정과 모델 목록이 달라요.', auth: 'oauth', url: 'https://chatgpt.com/backend-api/codex', models: [], loginLabel: 'ChatGPT로 로그인'},
  ]},
  {id: 'anthropic', name: 'Anthropic · Claude', mark: 'A', detail: 'Claude 모델 · API 키', url: 'https://api.anthropic.com', models: [
    {id: 'claude-opus-5', name: 'Claude Opus 5', detail: '생각 모드와 노력 수준 조절', effort: [...levels, 'xhigh', 'max'], thinking: true, tools: ['web', 'code']},
    {id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', detail: '적응형 생각 모드', effort: [...levels, 'max'], thinking: true, tools: ['web', 'code']},
  ]},
  {id: 'google', name: 'Google Gemini', mark: 'G', detail: 'Gemini 모델', url: 'https://generativelanguage.googleapis.com', models: [
    {id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', detail: '빠른 응답과 생각 수준 조절', effort: levels, tools: ['web', 'code']},
    {id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', detail: '복잡한 작업 · 미리보기 모델', effort: levels, tools: ['web', 'code']},
  ], routes: [
    {id: 'api', name: 'API 키', detail: 'Google AI Studio에서 발급한 키를 사용해요.', auth: 'apiKey', url: 'https://generativelanguage.googleapis.com'},
    {id: 'oauth', name: 'Google Cloud 계정', detail: 'Cloud 프로젝트의 API 권한으로 연결해요.', auth: 'oauth', url: 'https://generativelanguage.googleapis.com', models: [], loginLabel: 'Google로 로그인', projectRequired: true},
  ]},
  {id: 'xai', name: 'xAI · Grok', mark: 'x', detail: 'Grok 모델 · 웹과 X 검색', url: 'https://api.x.ai/v1', models: [
    {id: 'grok-4.6', name: 'Grok 4.6', detail: '추론 · 웹과 X 검색', effort: [...levels, 'xhigh'], tools: ['web', 'x', 'files', 'code']},
    {id: 'grok-4.5', name: 'Grok 4.5', detail: '추론 강도 3단계', effort: levels, tools: ['web', 'x', 'files', 'code']},
  ], routes: [
    {id: 'api', name: 'API 키', detail: 'xAI API 계정으로 연결해요.', auth: 'apiKey', url: 'https://api.x.ai/v1'},
    {id: 'oauth', name: 'Grok 계정', detail: '사용 가능한 모델은 계정과 요금제에 따라 달라요.', auth: 'oauth', url: 'https://api.x.ai/v1', models: [], loginLabel: 'Grok으로 로그인'},
  ]},
  {id: 'deepseek', name: 'DeepSeek', mark: 'D', detail: '생각 모드를 전환하는 대화', url: 'https://api.deepseek.com', models: [
    {id: 'deepseek-flash', name: 'DeepSeek Flash', detail: '생각 모드와 추론 강도 조절', effort: ['low', 'high', 'max'], thinking: true, effortNeedsThinking: true, sampling: true, samplingWithoutThinking: true, stop: true, tools: []},
  ]},
  {id: 'openrouter', name: 'OpenRouter', mark: 'R', detail: '여러 회사의 모델을 한곳에서', url: 'https://openrouter.ai/api/v1', models: [
    {id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', detail: 'Anthropic · 처리 업체 선택 가능', effort: levels, tools: []},
    {id: 'openai/gpt-5.5', name: 'GPT-5.5', detail: 'OpenAI · 처리 업체 선택 가능', effort: levels, verbosity: true, tools: []},
  ], routes: [
    {id: 'api', name: 'API 키', detail: 'OpenRouter에서 발급한 키를 사용해요.', auth: 'apiKey', url: 'https://openrouter.ai/api/v1'},
    {id: 'oauth', name: 'OpenRouter 계정', detail: '계정에서 이 앱의 연결을 승인해요.', auth: 'oauth', url: 'https://openrouter.ai/api/v1', loginLabel: 'OpenRouter로 로그인'},
  ]},
  // https://platform.minimax.io/docs/api-reference/text-openai-api
  {id: 'minimax', name: 'MiniMax', mark: 'M', detail: 'MiniMax 모델 · API 키 또는 계정 연결', url: 'https://api.minimax.io/v1', models: [
    {id: 'MiniMax-M3', name: 'MiniMax M3', detail: '생각 모드 · 텍스트와 이미지', effort: [], thinking: true, adaptiveThinking: true, sampling: true, tools: []},
    {id: 'MiniMax-M2.7', name: 'MiniMax M2.7', detail: '항상 생각하는 모델', effort: [], sampling: true, tools: []},
  ], routes: [
    {id: 'api', name: 'API 키 · 글로벌', detail: 'MiniMax 글로벌 플랫폼에서 발급한 키', auth: 'apiKey', url: 'https://api.minimax.io/v1'},
    {id: 'api-cn', name: 'API 키 · 중국', detail: '중국 플랫폼에서 발급한 키를 별도로 사용해요.', auth: 'apiKey', url: 'https://api.minimaxi.com/v1'},
    {id: 'oauth', name: 'MiniMax 계정', detail: '글로벌 계정으로 로그인해 연결해요.', auth: 'oauth', url: 'https://api.minimax.io/anthropic', models: [], loginLabel: 'MiniMax로 로그인'},
  ]},
  // https://platform.xiaomimimo.com/docs/en-US/usage-guide/passing-back-reasoning_content
  {id: 'xiaomi', name: 'Xiaomi · MiMo', mark: 'Mi', detail: '샤오미 MiMo 모델 · API 키', url: 'https://api.xiaomimimo.com/v1', models: [
    {id: 'mimo-v2.5-pro', name: 'MiMo V2.5 Pro', detail: '생각 모드 전환', effort: [], thinking: true, sampling: true, samplingWithoutThinking: true, tools: []},
    {id: 'mimo-v2.5', name: 'MiMo V2.5', detail: '텍스트와 이미지 · 생각 모드 전환', effort: [], thinking: true, sampling: true, samplingWithoutThinking: true, tools: []},
  ]},
  // https://www.alibabacloud.com/help/en/model-studio/qwen-api-via-openai-chat-completions
  {id: 'qwen', name: 'Qwen', mark: 'Q', detail: '알리바바 모델 · API 키 또는 Qwen 계정', url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', models: [
    {id: 'qwen3.7-plus', name: 'Qwen3.7 Plus', detail: '생각 모드와 생성 옵션 조절', effort: [], thinking: true, sampling: true, stop: true, tools: []},
    {id: 'qwen3.5-plus', name: 'Qwen3.5 Plus', detail: '텍스트와 이미지 · 생각 모드 전환', effort: [], thinking: true, sampling: true, stop: true, tools: []},
  ], routes: [
    {id: 'api', name: 'API 키 · 싱가포르', detail: 'Alibaba Cloud Model Studio에서 발급한 키', auth: 'apiKey', url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'},
    {id: 'api-cn', name: 'API 키 · 중국', detail: '중국 리전의 DashScope 키를 사용해요.', auth: 'apiKey', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1'},
    {id: 'oauth', name: 'Qwen 계정', detail: 'Qwen Portal · API 계정과 모델 목록이 달라요.', auth: 'oauth', url: 'https://portal.qwen.ai/v1', models: [], loginLabel: 'Qwen으로 로그인'},
  ]},
  // https://docs.z.ai/api-reference/llm/chat-completion
  {id: 'zai', name: 'Z.AI · GLM', mark: 'Z', detail: 'GLM 모델 · API 키', url: 'https://api.z.ai/api/paas/v4', models: [
    {id: 'glm-5.3', name: 'GLM-5.3', detail: '생각 모드와 추론 강도 조절', effort: ['low', 'high', 'max'], thinking: true, effortNeedsThinking: true, tools: []},
    {id: 'glm-5.2', name: 'GLM-5.2', detail: '긴 문맥과 깊이 있는 추론', effort: ['high', 'max'], thinking: true, effortNeedsThinking: true, tools: []},
  ]},
  // https://platform.kimi.com/docs/guide/use-reasoning-effort
  {id: 'kimi', name: 'Kimi · Moonshot', mark: 'K', detail: 'Kimi 모델 · API 키', url: 'https://api.moonshot.ai/v1', models: [
    {id: 'kimi-k3', name: 'Kimi K3', detail: '항상 생각하는 모델 · 추론 강도 3단계', effort: ['low', 'high', 'max'], tools: []},
    {id: 'kimi-k2.6', name: 'Kimi K2.6', detail: '생각 모드 전환 · 텍스트와 이미지', effort: [], thinking: true, tools: []},
  ], routes: [
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
  return {name: service.name, key: '', url: route.url, model, project: '', ollamaMode: route.id === 'cloud' ? 'cloud' : 'local', protocol: 'chat', modelPresets: {[model]: createModelPreset(service.id)}};
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
  return connectionModels(service, connection).find(model => model.id === id) ?? {id, name: id || '모델 선택', detail: '직접 입력한 모델', effort: [], tools: []};
}

export function modelPresetFor(service: AiService, connection: AiConnectionPreview): AiModelPresetPreview {
  return connection.modelPresets[connection.model] ?? createModelPreset(service);
}

export function choosePreviewModel(service: AiService, connection: AiConnectionPreview, model: AiModelPreview): AiConnectionPreview {
  return {...connection, model: model.id, modelPresets: {...connection.modelPresets, [model.id]: connection.modelPresets[model.id] ?? createModelPreset(service)}};
}

export function modelPresetCapabilities(service: AiServicePreview, connection: AiConnectionPreview) {
  const model = previewModel(service, connection.model, connection);
  const preset = modelPresetFor(service.id, connection);
  const known = connectionModels(service, connection).some(item => item.id === model.id);
  const thinkingOff = preset.thinking === 'disabled';
  const efforts = model.effort.filter(effort => {
    if (model.effortNeedsThinking && thinkingOff) return false;
    return !(service.id === 'anthropic' && model.id === 'claude-opus-5' && thinkingOff && ['xhigh', 'max'].includes(effort));
  });
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
