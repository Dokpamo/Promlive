/** UI fixtures, checked against provider docs on 2026-09-21. No API discovery or credentials are persisted. */
export type AiService = 'openai' | 'anthropic' | 'google' | 'xai' | 'deepseek' | 'openrouter' | 'ollama' | 'custom';
export type AiTool = 'web' | 'x' | 'files' | 'code';
export interface AiModelPreview {
  id: string; name: string; detail: string;
  effort: string[];
  thinking?: boolean;
  verbosity?: boolean;
  sampling?: boolean;
  tools: AiTool[];
}
export interface AiServicePreview {
  id: AiService; name: string; mark: string; detail: string; url: string;
  models: AiModelPreview[];
}
const levels = ['low', 'medium', 'high'];
export const aiServices: AiServicePreview[] = [
  {id: 'openai', name: 'OpenAI', mark: 'O', detail: 'GPT 모델', url: 'https://api.openai.com/v1', models: [
    {id: 'gpt-6-astra', name: 'GPT-6 Astra', detail: '깊이 있는 추론', effort: [...levels, 'xhigh', 'max'], tools: ['web', 'files', 'code']},
    {id: 'gpt-5.5', name: 'GPT-5.5', detail: '추론과 답변 상세도 조절', effort: [...levels, 'xhigh'], verbosity: true, tools: ['web', 'files', 'code']},
    {id: 'gpt-4.1', name: 'GPT-4.1', detail: '생성 옵션을 직접 조절하는 대화', effort: [], sampling: true, tools: ['web', 'files', 'code']},
  ]},
  {id: 'anthropic', name: 'Anthropic', mark: 'A', detail: 'Claude 모델', url: 'https://api.anthropic.com', models: [
    {id: 'claude-opus-5', name: 'Claude Opus 5', detail: '생각 모드와 노력 수준 조절', effort: [...levels, 'xhigh', 'max'], thinking: true, tools: ['web', 'code']},
    {id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', detail: '적응형 생각 모드', effort: [...levels, 'max'], thinking: true, tools: ['web', 'code']},
  ]},
  {id: 'google', name: 'Google Gemini', mark: 'G', detail: 'Gemini 모델', url: 'https://generativelanguage.googleapis.com', models: [
    {id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', detail: '빠른 응답과 생각 수준 조절', effort: levels, tools: ['web', 'code']},
    {id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', detail: '복잡한 작업 · 미리보기 모델', effort: levels, tools: ['web', 'code']},
  ]},
  {id: 'xai', name: 'xAI · Grok', mark: 'x', detail: 'Grok 모델 · 웹과 X 검색', url: 'https://api.x.ai/v1', models: [
    {id: 'grok-4.6', name: 'Grok 4.6', detail: '추론 · 웹과 X 검색', effort: [...levels, 'xhigh'], tools: ['web', 'x', 'files', 'code']},
    {id: 'grok-4.5', name: 'Grok 4.5', detail: '추론 강도 3단계', effort: levels, tools: ['web', 'x', 'files', 'code']},
  ]},
  {id: 'deepseek', name: 'DeepSeek', mark: 'D', detail: '생각 모드를 전환하는 대화', url: 'https://api.deepseek.com', models: [
    {id: 'deepseek-flash', name: 'DeepSeek Flash', detail: '생각 모드와 추론 강도 조절', effort: ['low', 'high', 'max'], thinking: true, sampling: true, tools: []},
  ]},
  {id: 'openrouter', name: 'OpenRouter', mark: 'R', detail: '여러 회사의 모델을 한곳에서', url: 'https://openrouter.ai/api/v1', models: [
    {id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', detail: 'Anthropic · 처리 업체 선택 가능', effort: levels, tools: []},
    {id: 'openai/gpt-5.5', name: 'GPT-5.5', detail: 'OpenAI · 처리 업체 선택 가능', effort: levels, verbosity: true, tools: []},
  ]},
  {id: 'ollama', name: 'Ollama', mark: 'O', detail: '내 컴퓨터 또는 Ollama Cloud', url: 'http://localhost:11434', models: []},
  {id: 'custom', name: '직접 연결', mark: '+', detail: '호환 API의 주소를 직접 입력', url: '', models: []},
];

export interface AiConnectionPreview {
  name: string; key: string; url: string; model: string;
  effort: string; thinking: string; verbosity: string; length: string; maxTokens: string;
  temperature: string; topP: string; stop: string; tools: AiTool[];
  routing: string; hosts: string; fallback: boolean; dataPolicy: string;
  inputPrice: string; outputPrice: string;
  ollamaMode: string; context: string; keepAlive: string; protocol: string;
  filters: Record<string, string>;
}
export interface AiSettingsPreviewState {
  service: AiService;
  connections: Record<AiService, AiConnectionPreview>;
}

export function createAiSettingsPreview(): AiSettingsPreviewState {
  const connections = {} as Record<AiService, AiConnectionPreview>;
  for (const service of aiServices) connections[service.id] = {
    name: service.name, key: '', url: service.url, model: service.models[0]?.id ?? '',
    effort: 'default', thinking: 'default', verbosity: 'default', length: 'balanced', maxTokens: 'default',
    temperature: '', topP: '', stop: '', tools: [], routing: 'auto', hosts: '', fallback: true,
    dataPolicy: 'default', inputPrice: '', outputPrice: '', ollamaMode: 'local', context: '', keepAlive: 'default',
    protocol: 'chat', filters: {harassment: 'default', hate: 'default', sexual: 'default', dangerous: 'default'},
  };
  return {service: 'xai', connections};
}

export const effortLabels: Record<string, string> = {default: '모델 기본값', minimal: '최소', low: '낮음', medium: '보통', high: '높음', xhigh: '매우 높음', max: '최대'};
export const lengthLabels: Record<string, string> = {short: '간결하게', balanced: '균형 있게', long: '자세하게'};
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

export function previewModel(service: AiServicePreview, id: string): AiModelPreview {
  return service.models.find(model => model.id === id) ?? {id, name: id || '모델 선택', detail: '직접 입력한 모델', effort: [], tools: []};
}

export function choosePreviewModel(connection: AiConnectionPreview, model: AiModelPreview): AiConnectionPreview {
  return {...connection, model: model.id, effort: 'default', thinking: 'default', verbosity: 'default', tools: connection.tools.filter(tool => model.tools.includes(tool))};
}
