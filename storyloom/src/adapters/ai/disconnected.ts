import {AiUnavailableError, type AiProvider, type AiRequest, type AiEvent} from '../../ports/ai';
export class DisconnectedProvider implements AiProvider {
  readonly id = 'not-connected'; readonly label = '연결 대기'; readonly connected = false;
  readonly research = false; readonly inputCharacterLimit = 24000;
  async *stream(_request: AiRequest, _signal: AbortSignal): AsyncIterable<AiEvent> { throw new AiUnavailableError(); }
}
