import type {TextStreamRequest, TextStreamTransport} from '../../ports/transport';

// Some providers report authentication failures as 400. Inspect only to classify;
// upstream text can echo a credential or the prompt and must never reach the UI/logs.
function httpFailure(status: number, body: string): Error {
  const detail = body.slice(0, 16000);
  const suffix = ` (HTTP ${status})`;
  if (status === 401 || /(?:incorrect|invalid|missing|expired)[ _-]*(?:api[ _-]*)?(?:key|token)|authentication[ _-]*(?:failed|error)|unauthorized/i.test(detail)) {
    return new Error(`AI 인증에 실패했어요. 설정에서 API 키를 확인해 주세요.${suffix}`);
  }
  if (status === 402 || /insufficient[ _-]*(?:credits?|quota|balance)|(?:credits?|balance)[^\n]{0,60}(?:exhausted|depleted|too low)|(?:no|does(?:n.t| not) have any|out of)[ _-]*credits/i.test(detail)) {
    return new Error(`AI 사용 잔액이나 한도를 확인해 주세요.${suffix}`);
  }
  if (status === 403) return new Error(`이 모델을 사용할 권한이 없어요. 연결 계정과 모델을 확인해 주세요.${suffix}`);
  if (status === 429) return new Error(`AI 요청 한도에 도달했어요. 잠시 뒤 다시 시도해 주세요.${suffix}`);
  if (/model[^\n]{0,100}(?:not found|not available|does not exist|deprecated|not supported)|(?:unknown|invalid|unsupported)[ _-]*model/i.test(detail)) {
    return new Error(`선택한 모델을 사용할 수 없어요. AI 설정에서 모델을 다시 선택해 주세요.${suffix}`);
  }
  return new Error(`AI 제공자가 요청을 처리하지 못했습니다.${suffix}`);
}
// XHR progress works on RN hosts where fetch does not expose ReadableStream.
// Only this adapter touches networking; responses and credentials are never logged.
export class XhrTransport implements TextStreamTransport {
  async *stream(request: TextStreamRequest, signal: AbortSignal): AsyncIterable<string> {
    const xhr = new XMLHttpRequest();
    let done = false; let error: Error | null = null; let offset = 0;
    const queue: string[] = []; let wake: (() => void) | undefined;
    const finish = (failure?: Error) => {if (done) return; done = true; error = failure ?? null; wake?.();};
    const progress = () => {
      if (xhr.status < 200 || xhr.status >= 300) return;
      const response = xhr.responseText;
      if (response.length > 2000000) {finish(new Error('AI 전송량 제한에 도달했습니다.')); xhr.abort(); return;}
      const text = response.slice(offset); offset = response.length;
      if (text) {queue.push(text); wake?.();}
    };
    const abort = () => {finish(new Error('AI 요청이 중단되었습니다.')); xhr.abort();};
    if (signal.aborted) throw new Error('AI 요청이 중단되었습니다.');
    xhr.open('POST', request.url); xhr.timeout = 120000;
    for (const [name, value] of Object.entries(request.headers)) xhr.setRequestHeader(name, value);
    xhr.onprogress = progress;
    xhr.onload = () => {if (xhr.status < 200 || xhr.status >= 300) finish(httpFailure(xhr.status, xhr.responseText)); else {progress(); finish();}};
    xhr.onerror = () => finish(new Error('네트워크 연결이 끊겼습니다.'));
    xhr.ontimeout = () => finish(new Error('네트워크 응답 시간이 초과되었습니다.'));
    xhr.onabort = () => finish(new Error('AI 요청이 중단되었습니다.'));
    signal.addEventListener('abort', abort, {once: true});
    try {
      xhr.send(request.body);
      while (!done || queue.length) {
        const text = queue.shift();
        if (text !== undefined) yield text;
        else if (!done) await new Promise<void>(resolve => {wake = resolve;});
      }
      if (error) throw error;
    } finally {
      signal.removeEventListener('abort', abort); xhr.onprogress = xhr.onload = xhr.onerror = xhr.ontimeout = xhr.onabort = null; xhr.abort();
    }
  }
}
