import {expect, it, vi} from 'vitest';
import {repository} from './helpers';
import {AiSettingsPreferences} from '../src/features/settings/aiSettingsPreferences';
import {SelectedProvider} from '../src/adapters/ai/selectedProvider';
import {GenerationCoordinator} from '../src/features/chat/generation';
import type {TextStreamRequest} from '../src/ports/transport';

it('uses the saved selected model and host-owned xAI endpoint without exposing a key to generated inputs', async () => {
  const repo = await repository();
  const keys = new Map<string, string>();
  const credentials = {get: async (id: string) => keys.get(id) ?? null, set: async (id: string, value: string) => {keys.set(id, value);}, remove: async (id: string) => {keys.delete(id);}};
  const preferences = new AiSettingsPreferences(repo, credentials);
  const sent: TextStreamRequest[] = [];
  const provider = new SelectedProvider(preferences, credentials, {async *stream(request) {sent.push(request); yield 'data: {"choices":[{"delta":{"content":"결과"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';}});
  try {
    await preferences.load(); expect(provider.connected).toBe(false);
    preferences.update(previous => ({...previous, connections: {...previous.connections, xai: {...previous.connections.xai, model: 'user-selected-model', key: 'test-only-key', url: 'https://untrusted.invalid'}}}));
    expect(provider.connected).toBe(true);
    await new GenerationCoordinator(provider).run({id: 'selected', purpose: 'creator', context: '작은 계약', instruction: '요약', messages: []}, () => {});
    expect(sent[0]?.url).toBe('https://api.x.ai/v1/chat/completions');
    expect(JSON.parse(sent[0]!.body).model).toBe('user-selected-model');
    expect(sent[0]?.headers.Authorization).toBe('Bearer test-only-key');
    expect(sent[0]?.body).not.toContain('test-only-key');
    preferences.update(previous => ({...previous, service: 'anthropic'})); await preferences.flush();
    expect(provider.connected).toBe(false);
  } finally {await repo.db.close();}
});

it('does not send with an old key when saving the newly selected connection fails', async () => {
  const repo = await repository();
  const credentials = {get: async (id: string) => id === 'com.promlive.ai.xai.api' ? 'old-test-only-key' : null, set: async () => {throw new Error('keychain unavailable');}, remove: async () => {}};
  const preferences = new AiSettingsPreferences(repo, credentials);
  const sent = vi.fn();
  const provider = new SelectedProvider(preferences, credentials, {async *stream() {sent(); yield '';}});
  try {
    await preferences.load();
    preferences.update(previous => ({...previous, connections: {...previous.connections, xai: {...previous.connections.xai, key: 'new-test-only-key'}}}));
    await expect(new GenerationCoordinator(provider).run({id: 'unsaved-connection', purpose: 'creator', context: '', instruction: '요약', messages: []}, () => {})).rejects.toThrow('API 키를 저장하지 못했어요');
    expect(sent).not.toHaveBeenCalled();
  } finally {await preferences.flush(); await repo.db.close();}
});
