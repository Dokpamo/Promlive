import type {TextStreamRequest, TextStreamTransport} from '../../ports/transport';
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
    xhr.onload = () => {if (xhr.status < 200 || xhr.status >= 300) finish(new Error(`AI 제공자가 요청을 처리하지 못했습니다. (HTTP ${xhr.status})`)); else {progress(); finish();}};
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
