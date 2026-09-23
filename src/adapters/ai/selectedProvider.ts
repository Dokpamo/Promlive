import type {AiProvider, AiRequest, CredentialStore} from '../../ports/ai';
import {AiUnavailableError} from '../../ports/ai';
import type {TextStreamTransport} from '../../ports/transport';
import type {AiSettingsPreferences} from '../../features/settings/aiSettingsPreferences';
import {modelPresetFor} from '../../features/settings/aiSettingsModel';
import {resolveOutputLimit} from '../../features/settings/aiOutputLimit';
import {GrokProvider} from './grok';

/** Resolve only a host-owned connection. Extensions never receive keys or choose endpoints. */
export class SelectedProvider implements AiProvider {
  readonly id = 'selected'; readonly label = '설정에서 선택한 모델'; readonly research = false;
  readonly inputCharacterLimit = 24000;
  constructor(private readonly preferences: AiSettingsPreferences, private readonly credentials: CredentialStore, private readonly transport: TextStreamTransport) {}
  get connected() {
    const {ready, value} = this.preferences.snapshot();
    const connection = value.connections.xai;
    return ready && value.service === 'xai' && connection.routeId === 'api' && !!connection.key.trim() && !!connection.model;
  }
  async *stream(request: AiRequest, signal: AbortSignal) {
    if (!this.connected) throw new AiUnavailableError();
    const connection = this.preferences.snapshot().value.connections.xai;
    // Finish pending credential writes before using the stable keychain reference.
    const model = connection.model;
    const maxOutputTokens = resolveOutputLimit(modelPresetFor('xai', connection).maxTokens);
    const key = connection.key.trim();
    const credentialReference = 'com.promlive.ai.xai.api';
    await this.preferences.flush();
    const savedKey = await this.credentials.get(credentialReference);
    if (savedKey?.trim() !== key) throw new Error('연결 설정이 바뀌었거나 API 키를 저장하지 못했어요. AI 설정을 확인한 뒤 다시 시도해 주세요.');
    // Keep this request on its captured connection even if settings change mid-stream.
    const provider = new GrokProvider({model, credentialReference, inputCharacterLimit: this.inputCharacterLimit, maxOutputTokens}, {get: async reference => reference === credentialReference ? key : null}, this.transport);
    yield* provider.stream(request, signal);
  }
}
