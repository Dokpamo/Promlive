import {z} from 'zod';
import {AiCatalogError, type AiCatalogEntry, type AiCatalogKind} from '../../ports/aiCatalog';
import {requestCatalog, type CatalogRequest} from './catalogRequest';

const strings = z.array(z.string()).max(100);
const id = z.string().min(1).max(500);
const number = z.number().nonnegative().nullish();
const supported = z.object({supported: z.boolean()}).passthrough();
const capabilities = z.object({
  effort: z.record(z.string(), z.unknown()).nullish(),
  thinking: supported.extend({types: z.object({adaptive: supported.optional()}).optional()}).nullish(),
  code_execution: supported.nullish(), web_search: supported.nullish(), image_input: supported.nullish(),
}).nullish();
const model = z.object({
  id, name: z.string().nullish(), display_name: z.string().nullish(), context_length: number,
  max_input_tokens: number, max_tokens: number, supported_parameters: strings.nullish(), capabilities,
  architecture: z.object({input_modalities: strings.nullish(), output_modalities: strings.nullish()}).nullish(),
  top_provider: z.object({max_completion_tokens: number}).nullish(),
  reasoning: z.object({supported_efforts: strings.nullish(), default_effort: z.string().max(100).nullish(), default_enabled: z.boolean().nullish(), mandatory: z.boolean().nullish()}).nullish(),
});
const compatible = z.object({data: z.array(model).max(10000), has_more: z.boolean().optional(), last_id: z.string().nullish()});
const gemini = z.object({models: z.array(z.object({
  name: id, displayName: z.string().optional(), supportedGenerationMethods: strings,
  inputTokenLimit: number, outputTokenLimit: number,
})).max(10000), nextPageToken: z.string().optional()});
const ollama = z.object({models: z.array(z.object({model: id.optional(), name: id.optional()})).max(10000)});
const qwen = z.object({success: z.boolean().optional(), output: z.object({
  total: z.number().nonnegative(), page_no: z.number().int().positive(), page_size: z.number().int().positive(),
  models: z.array(z.object({
    model: id, name: z.string().nullish(), features: strings.nullish(),
    inference_metadata: z.object({request_modality: strings.nullish(), response_modality: strings.nullish()}).nullish(),
    model_info: z.object({context_window: number, max_output_tokens: number}).nullish(),
  })).max(1000),
})});

/** These endpoints follow the providers' list-models contracts (documented in docs/ai-catalogs.md). */
const hosts: Record<string, string[]> = {
  openai: ['api.openai.com'], anthropic: ['api.anthropic.com'], google: ['generativelanguage.googleapis.com'],
  openrouter: ['openrouter.ai'], deepseek: ['api.deepseek.com'],
  minimax: ['api.minimax.io', 'api.minimaxi.com', 'api.minimax.cn'], xiaomi: ['api.xiaomimimo.com'],
  kimi: ['api.moonshot.ai', 'api.moonshot.cn'], qwen: ['dashscope-intl.aliyuncs.com', 'dashscope.aliyuncs.com', 'cn-hongkong.dashscope.aliyuncs.com'],
};
export function providerCatalogUrl(provider: string, base: string, workspace = ''): string {
  if (/[\\@\s]/.test(base.trim())) throw new AiCatalogError('endpoint');
  let url: URL;
  try {url = new URL(base.trim());} catch {throw new AiCatalogError('endpoint');}
  if (url.username || url.password || url.search || url.hash) throw new AiCatalogError('endpoint');
  if (provider === 'ollama' || provider === 'custom') {
    if (!['https:', 'http:'].includes(url.protocol)) throw new AiCatalogError('endpoint');
    return `${url.origin}${url.pathname.replace(/\/$/, '')}${provider === 'ollama' ? '/api/tags' : '/models'}`;
  }
  const qwenWorkspace = provider === 'qwen' && /^[a-z0-9-]+\.(?:cn-beijing|ap-southeast-1|us-east-1|eu-central-1|ap-northeast-1)\.maas\.aliyuncs\.com$/.test(url.hostname);
  if (url.protocol !== 'https:' || url.port || !(hosts[provider]?.includes(url.hostname) || qwenWorkspace)) throw new AiCatalogError('endpoint');
  if (provider === 'qwen' && url.hostname === 'dashscope.aliyuncs.com') {
    if (!/^[a-z0-9-]+$/.test(workspace.trim())) throw new AiCatalogError('workspace');
    return `https://${workspace.trim()}.cn-beijing.maas.aliyuncs.com/api/v1/models`;
  }
  const path = provider === 'google' ? '/v1beta/models' : provider === 'openrouter' ? '/api/v1/models' : provider === 'qwen' ? '/api/v1/models' : '/v1/models';
  return `${url.origin}${path}`;
}

function inferredKind(provider: string, modelId: string, output: string[]): AiCatalogKind | null {
  if (output.includes('image')) return 'image';
  if (output.includes('video')) return 'video';
  if (output.some(value => ['audio', 'speech', 'transcription'].includes(value))) return 'audio';
  if (output.length) return output.includes('text') ? 'chat' : null;
  const name = modelId.toLowerCase();
  if (/embed|rerank|moderation|ocr/.test(name)) return null;
  if (/image|dall-e|imagen|t2i|i2i/.test(name)) return 'image';
  if (/sora|veo|hailuo|video|t2v|i2v|r2v|kf2v|s2v|happyhorse|happyoyster|^minimax-h3|^models\/gemini-omni|^gemini-omni/.test(name)) return 'video';
  if (/audio|speech|tts|asr|whisper|transcri|realtime|music|lyria|(?:^|-)live(?:-|$)|cosyvoice|paraformer/.test(name)) return 'audio';
  if (provider === 'qwen' && name.includes('omni') && name !== 'qwen3.8-omni-flash') return 'audio';
  if (provider === 'openai' && !/^(?:ft:)?(?:gpt-|chatgpt-|chat-latest|o\d)/.test(name)) return null;
  return 'chat';
}

function limits(context?: number | null, output?: number | null): Pick<AiCatalogEntry, 'contextLength' | 'maxOutputTokens'> {
  return {...(context ? {contextLength: context} : {}), ...(output ? {maxOutputTokens: output} : {})};
}

function baseEntry(id: string, name: string, inputModalities: string[] = [], outputModalities: string[] = []): AiCatalogEntry {
  return {id, name, aliases: [], inputModalities, outputModalities};
}

export function parseProviderCatalog(provider: string, body: unknown, kind: AiCatalogKind): {entries: AiCatalogEntry[]; next?: string} {
  if (provider === 'google') {
    const result = gemini.safeParse(body);
    if (!result.success) throw new AiCatalogError('response');
    return {entries: result.data.models.filter(row => {
      const category = inferredKind(provider, row.name, []);
      return category === kind && (kind !== 'chat' || row.supportedGenerationMethods.includes('generateContent'));
    }).map(row => ({...baseEntry(row.name.replace(/^models\//, ''), row.displayName || row.name), ...limits(row.inputTokenLimit, row.outputTokenLimit)})), ...(result.data.nextPageToken ? {next: result.data.nextPageToken} : {})};
  }
  if (provider === 'ollama') {
    const result = ollama.safeParse(body);
    if (!result.success || result.data.models.some(row => !row.model && !row.name)) throw new AiCatalogError('response');
    return {entries: kind === 'chat' ? result.data.models.filter(row => inferredKind(provider, (row.model || row.name)!, []) === 'chat').map(row => baseEntry((row.model || row.name)!, (row.name || row.model)!)) : []};
  }
  if (provider === 'qwen') {
    const result = qwen.safeParse(body);
    if (!result.success || result.data.success === false) throw new AiCatalogError('response');
    const page = result.data.output;
    return {entries: page.models.flatMap(row => {
      const input = row.inference_metadata?.request_modality?.map(value => value.toLowerCase()) ?? [];
      const output = row.inference_metadata?.response_modality?.map(value => value.toLowerCase()) ?? [];
      if (inferredKind(provider, row.model, output) !== kind) return [];
      return [{...baseEntry(row.model, row.name || row.model, input, output), ...limits(row.model_info?.context_window, row.model_info?.max_output_tokens),
        ...(row.features ? {tools: row.features.includes('web-search') ? ['web' as const] : []} : {})}];
    }), ...(page.page_no * page.page_size < page.total ? {next: String(page.page_no + 1)} : {})};
  }
  const result = compatible.safeParse(body);
  if (!result.success || (result.data.has_more && !result.data.last_id)) throw new AiCatalogError('response');
  return {entries: result.data.data.flatMap(row => {
    const input = row.architecture?.input_modalities ?? [];
    const output = row.architecture?.output_modalities ?? [];
    if (inferredKind(provider, row.id, output) !== kind) return [];
    const entry: AiCatalogEntry = {...baseEntry(row.id, row.display_name || row.name || row.id, input, output),
      ...limits(row.context_length ?? row.max_input_tokens, row.max_tokens ?? row.top_provider?.max_completion_tokens),
      ...(row.supported_parameters ? {parameters: row.supported_parameters} : {}),
    };
    const caps = row.capabilities;
    if (caps?.effort) entry.reasoningEfforts = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'].filter(level => supported.safeParse(caps.effort?.[level]).data?.supported);
    if (provider === 'openrouter') {
      const reasoning = row.reasoning;
      // The router's own contract takes precedence over a model vendor's options.
      const efforts = reasoning?.supported_efforts === null ? ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] : reasoning?.supported_efforts ?? [];
      entry.reasoningEfforts = efforts.filter(effort => effort !== 'none' || !reasoning?.mandatory);
      if (reasoning?.default_enabled === false && !reasoning.mandatory) entry.defaultReasoningEffort = 'none';
      else if (reasoning?.default_effort) entry.defaultReasoningEffort = reasoning.default_effort;
    }
    if (caps?.thinking) {entry.thinking = caps.thinking.supported; entry.adaptiveThinking = caps.thinking.types?.adaptive?.supported ?? false;}
    if (caps?.image_input?.supported) entry.inputModalities = ['text', 'image'];
    if (caps?.code_execution || caps?.web_search) entry.tools = [...(caps.code_execution?.supported ? ['code' as const] : []), ...(caps.web_search?.supported ? ['web' as const] : [])];
    return [entry];
  }), ...(result.data.has_more ? {next: result.data.last_id!} : {})};
}

export async function loadProviderCatalog(provider: string, connection: {url: string; key: string; project?: string}, kind: AiCatalogKind, signal: AbortSignal, request: CatalogRequest = fetch): Promise<AiCatalogEntry[]> {
  // Z.AI has no documented model discovery endpoint. Its official catalog remains the fallback.
  if (provider === 'zai') throw new AiCatalogError('unavailable');
  const target = providerCatalogUrl(provider, connection.url, connection.project);
  const key = connection.key.trim();
  if (!key && !['openrouter', 'ollama', 'custom'].includes(provider)) throw new AiCatalogError('key');
  const headers: Record<string, string> = provider === 'anthropic' ? {'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'} :
    provider === 'google' ? {'x-goog-api-key': key} : provider === 'xiaomi' ? {'api-key': key} : key ? {Authorization: `Bearer ${key}`} : {};
  const entries: AiCatalogEntry[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 50; page++) {
    const query: Record<string, string> = {};
    if (provider === 'anthropic') {query.limit = '1000'; if (cursor) query.after_id = cursor;}
    else if (provider === 'google') {query.pageSize = '1000'; if (cursor) query.pageToken = cursor;}
    else if (provider === 'qwen') {query.page_no = cursor || '1'; query.page_size = '100';}
    else if (provider === 'openrouter') query.output_modalities = 'all';
    else if (cursor) query.after = cursor;
    const search = Object.entries(query).map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('&');
    const result = parseProviderCatalog(provider, await requestCatalog(`${target}${search ? `?${search}` : ''}`, headers, signal, request), kind);
    entries.push(...result.entries);
    if (!result.next) {
      // MiniMax documents language-model examples but does not guarantee media
      // coverage in /models. Accept media when returned; absence is inconclusive.
      if (provider === 'minimax' && kind !== 'chat' && entries.length === 0) throw new AiCatalogError('unavailable');
      return [...new Map(entries.map(entry => [entry.id, entry])).values()];
    }
    if (seenCursors.has(result.next) || entries.length > 10000) throw new AiCatalogError('response');
    seenCursors.add(result.next);
    cursor = result.next;
  }
  throw new AiCatalogError('response');
}
