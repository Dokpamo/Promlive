import {sha256} from '@noble/hashes/sha2.js';
import {z} from 'zod';
import type {SettingsStore} from '../../ports/settings';
import {AiCatalogError, type AiCatalogKind} from '../../ports/aiCatalog';
import type {AiConnectionPreview, AiModelPreview, AiServicePreview} from './aiSettingsModel';
import {aiModelSchema} from './aiModelSchema';

export const aiCatalogCacheKey = 'ai:catalogs:v1';
const snapshotSchema = z.object({at: z.number(), models: z.array(aiModelSchema).max(10000)});
const diskSchema = z.object({version: z.literal(1), entries: z.record(z.string().regex(/^[a-f0-9]{64}$/), snapshotSchema)});
export type CatalogSnapshot = z.infer<typeof snapshotSchema>;

export function catalogScope(service: AiServicePreview, connection: AiConnectionPreview, kind: AiCatalogKind): string {
  // encodeURIComponent is available on native Hermes as well as web (no TextEncoder polyfill).
  const encoded = encodeURIComponent(JSON.stringify([service.id, connection.routeId, connection.url.trim().replace(/\/$/, ''), connection.protocol, connection.project, connection.key.trim(), kind]));
  const bytes = Uint8Array.from(encoded.match(/%[\da-f]{2}|./gi)!, token => token[0] === '%' ? parseInt(token.slice(1), 16) : token.charCodeAt(0));
  return Array.from(sha256(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Disk-backed non-secret catalogs. Openings always refresh; cache age never suppresses a lookup. */
export class AiCatalogCache {
  private entries = new Map<string, CatalogSnapshot>();
  private loading: Promise<void> | undefined;
  private saving = Promise.resolve();
  private pending = new Map<string, {controller: AbortController; promise: Promise<AiModelPreview[]>; readers: Set<symbol>}>();
  constructor(private readonly repo?: SettingsStore) {}
  load() {
    return this.loading ??= (async () => {
      if (!this.repo) return;
      try {
        const raw = await this.repo.getSetting(aiCatalogCacheKey);
        if (!raw) return;
        const saved = diskSchema.safeParse(JSON.parse(raw));
        if (!saved.success) return;
        for (const [key, value] of Object.entries(saved.data.entries).sort((a, b) => b[1].at - a[1].at).slice(0, 48)) {
          if (Date.now() - value.at < 30 * 86400000 && !this.entries.has(key)) this.entries.set(key, value);
        }
      } catch { /* Catalog storage is expendable; defaults and live discovery stay available. */ }
    })();
  }
  get(key: string) {return this.entries.get(key);}
  private save(key: string, models: AiModelPreview[]) {
    this.entries.set(key, {at: Date.now(), models: z.array(aiModelSchema).parse(models)});
    this.entries = new Map([...this.entries].sort((a, b) => b[1].at - a[1].at).slice(0, 48));
    if (!this.repo) return;
    const document = JSON.stringify({version: 1, entries: Object.fromEntries(this.entries)});
    this.saving = this.saving.then(() => this.repo!.setSetting(aiCatalogCacheKey, document)).catch(() => {});
  }
  async refresh(key: string, load: (signal: AbortSignal) => Promise<AiModelPreview[]>, signal: AbortSignal): Promise<AiModelPreview[]> {
    if (signal.aborted) throw new AiCatalogError('network');
    let pending = this.pending.get(key);
    if (!pending) {
      const controller = new AbortController();
      pending = {controller, readers: new Set(), promise: Promise.resolve([])};
      const current = pending;
      current.promise = Promise.resolve().then(() => load(controller.signal)).then(models => {
        if (!controller.signal.aborted) this.save(key, models);
        return models;
      }).finally(() => {if (this.pending.get(key) === current) this.pending.delete(key);});
      this.pending.set(key, current);
    }
    const current = pending;
    const reader = Symbol();
    current.readers.add(reader);
    const release = () => {
      current.readers.delete(reader);
      if (!current.readers.size) {current.controller.abort(); if (this.pending.get(key) === current) this.pending.delete(key);}
    };
    signal.addEventListener('abort', release, {once: true});
    try {return await current.promise;} finally {signal.removeEventListener('abort', release); release();}
  }
  flush() {return this.saving;}
}
