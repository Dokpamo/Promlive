import {AiUnavailableError, type AiProvider, type AiRequest, type AiEvent} from '../../ports/ai';
import {sourceSchema} from '../cards/model';

export class GenerationCoordinator {
  private readonly active = new Map<string, AbortController>();
  private readonly seen = new Set<string>();
  constructor(readonly provider: AiProvider, private readonly timeoutMs = 120000) {}
  cancel(id: string) { this.active.get(id)?.abort(new Error('사용자가 생성을 중단했습니다.')); }
  async run(request: AiRequest, onEvent: (event: AiEvent) => Promise<void> | void) {
    if (!this.provider.connected) throw new AiUnavailableError();
    if (request.purpose === 'research' && !this.provider.research) throw new Error('연결한 제공자는 출처가 있는 조사를 지원하지 않습니다.');
    if (this.seen.has(request.id)) throw new Error('이미 사용한 요청 ID입니다. 자동으로 재전송하지 않습니다.');
    if (this.active.size >= 2) throw new Error('동시에 두 개의 AI 작업까지 실행할 수 있습니다.');
    const inputLength = request.context.length + request.instruction.length + request.messages.reduce((n, m) => n + m.content.length, 0);
    if (inputLength > this.provider.inputCharacterLimit) throw new Error('전송할 내용이 제공자 입력 한도를 초과했습니다. 설정 또는 입력을 줄여 주세요.');
    this.seen.add(request.id);
    const controller = new AbortController();
    this.active.set(request.id, controller);
    const timer = setTimeout(() => controller.abort(new Error('응답 시간이 초과되었습니다. 부분 응답을 보존했습니다.')), this.timeoutMs);
    let bytes = 0; let completed = false; let sources = 0;
    let iterator: AsyncIterator<AiEvent> | undefined;
    let abortListener: () => void = () => {};
    const aborted = new Promise<never>((_, reject) => {
      abortListener = () => reject(controller.signal.reason ?? new Error('생성이 중단되었습니다.'));
      controller.signal.addEventListener('abort', abortListener, {once: true});
    });
    try {
      const stream = this.provider.stream(request, controller.signal) as AsyncIterable<AiEvent> & {'@@asyncIterator'?: () => AsyncIterator<AiEvent>};
      // Babel's async generators use this fallback on Hermes versions without Symbol.asyncIterator.
      const iterate = stream[Symbol.asyncIterator] ?? stream['@@asyncIterator'];
      if (!iterate) throw new Error('AI 응답 스트림을 열지 못했습니다.');
      iterator = iterate.call(stream);
      while (true) {
        const next = await Promise.race([iterator.next(), aborted]);
        if (controller.signal.aborted) throw controller.signal.reason;
        if (next.done) break;
        const event = next.value;
        if (event.type === 'delta') {
          if (typeof event.text !== 'string') throw new Error('잘못된 AI 응답 형식입니다.');
          bytes += event.text.length;
          if (bytes > 30000) throw new Error('응답 길이 제한에 도달했습니다. 부분 응답을 보존했습니다.');
        } else if (event.type === 'source') {
          sourceSchema.parse(event.source); sources++;
          if (sources > 30) throw new Error('출처 수 제한을 초과했습니다.');
        } else if (event.type === 'done') {
          if (request.purpose === 'research' && sources === 0) throw new Error('검증할 출처가 없는 조사 결과입니다.');
          completed = true;
        } else throw new Error('알 수 없는 AI 이벤트입니다.');
        await onEvent(event);
        if (completed) break;
      }
      if (!completed) throw new Error('정상 완료 신호 전에 연결이 끊겼습니다. 부분 응답을 보존했습니다.');
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', abortListener);
      controller.abort();
      void iterator?.return?.().catch(() => undefined);
      this.active.delete(request.id);
    }
  }
}
