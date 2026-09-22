import {z} from 'zod';
import {AiCatalogError, type AiCatalogEntry, type AiCatalogKind} from '../../ports/aiCatalog';
import {requestCatalog, type CatalogRequest} from './catalogRequest';
export type {CatalogRequest} from './catalogRequest';

// https://docs.x.ai/developers/rest-api-reference/inference/models
// https://docs.x.ai/developers/rest-api-reference/inference/voice
const endpoints: Partial<Record<AiCatalogKind, string>> = {
  chat: 'language-models', image: 'image-generation-models', video: 'video-generation-models', voice: 'tts/voices',
};
const strings = z.array(z.string()).max(100);
const modelSchema = z.object({
  id: z.string().min(1).max(500), name: z.string().nullish(), aliases: strings.nullish(),
  input_modalities: strings.nullish(), output_modalities: strings.nullish(),
  context_length: z.number().positive().nullish(),
  capabilities: z.object({reasoning_effort: strings.nullish()}).nullish(),
});
const modelsSchema = z.object({models: z.array(modelSchema).max(10000)});
const voicesSchema = z.object({voices: z.array(z.object({voice_id: z.string().min(1).max(500), name: z.string().nullish()})).max(1000)});

export function xaiCatalogUrl(base: string, kind: AiCatalogKind): string {
  if (!endpoints[kind]) throw new AiCatalogError('unavailable');
  if (/[\\@\s]/.test(base.trim())) throw new AiCatalogError('endpoint');
  let url: URL;
  try {url = new URL(base.trim());} catch {throw new AiCatalogError('endpoint');}
  if (url.protocol !== 'https:' || !['api.x.ai', 'us.api.x.ai'].includes(url.hostname) ||
      url.port || url.username || url.password || url.search || url.hash || !['', '/', '/v1', '/v1/'].includes(url.pathname)) {
    throw new AiCatalogError('endpoint');
  }
  return `${url.origin}/v1/${endpoints[kind]}`;
}

export function parseXaiCatalog(kind: AiCatalogKind, data: unknown): AiCatalogEntry[] {
  if (kind === 'voice') {
    const result = voicesSchema.safeParse(data);
    if (!result.success) throw new AiCatalogError('response');
    return unique(result.data.voices.map(voice => ({id: voice.voice_id, name: voice.name || voice.voice_id, aliases: [], inputModalities: ['text'], outputModalities: ['audio']})));
  }
  const result = modelsSchema.safeParse(data);
  if (!result.success) throw new AiCatalogError('response');
  return unique(result.data.models.map(model => ({
    id: model.id, name: model.name || model.id, aliases: model.aliases ?? [],
    inputModalities: model.input_modalities ?? [], outputModalities: model.output_modalities ?? [],
    ...(model.capabilities?.reasoning_effort ? {reasoningEfforts: model.capabilities.reasoning_effort} : {}),
    ...(model.context_length ? {contextLength: model.context_length} : {}),
  })));
}

function unique(models: AiCatalogEntry[]): AiCatalogEntry[] {
  return [...new Map(models.map(model => [model.id, model])).values()];
}

/** GET only. A lookup never invokes inference, uploads media, or persists credentials. */
export async function loadXaiCatalog({url, key}: {url: string; key: string}, kind: AiCatalogKind, signal: AbortSignal, request: CatalogRequest = fetch): Promise<AiCatalogEntry[]> {
  const target = xaiCatalogUrl(url, kind);
  if (!key.trim()) throw new AiCatalogError('key');
  return parseXaiCatalog(kind, await requestCatalog(target, {Authorization: `Bearer ${key.trim()}`}, signal, request));
}
