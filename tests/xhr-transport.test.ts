import {afterEach, describe, expect, it, vi} from 'vitest';
import {XhrTransport} from '../src/adapters/ai/xhrTransport';

function rejectRequest(status: number, body: string) {
  class RejectedXhr {
    status = status; responseText = body; timeout = 0;
    onload: (() => void) | null = null;
    onprogress = null; onerror = null; ontimeout = null; onabort = null;
    open() {} setRequestHeader() {} abort() {}
    send() {queueMicrotask(() => this.onload?.());}
  }
  vi.stubGlobal('XMLHttpRequest', RejectedXhr);
  return new XhrTransport().stream({url: 'https://api.x.ai/v1/chat/completions', headers: {}, body: '{}'}, new AbortController().signal)[Symbol.asyncIterator]().next();
}

afterEach(() => vi.unstubAllGlobals());
describe('provider failures without leaking upstream data', () => {
  it('classifies a 400 invalid-key response without echoing the key', async () => {
    await expect(rejectRequest(400, JSON.stringify({error: 'Incorrect API key provided: secret-test-only'})))
      .rejects.toThrow('AI 인증에 실패했어요. 설정에서 API 키를 확인해 주세요. (HTTP 400)');
  });
  it('explains model and billing failures with local text only', async () => {
    await expect(rejectRequest(404, '{"error":"The model private-model does not exist; prompt: private-conversation"}'))
      .rejects.toThrow('선택한 모델을 사용할 수 없어요. AI 설정에서 모델을 다시 선택해 주세요. (HTTP 404)');
    await expect(rejectRequest(400, '{"error":"Your team does not have any credits"}'))
      .rejects.toThrow('AI 사용 잔액이나 한도를 확인해 주세요. (HTTP 400)');
  });
  it('keeps an unrecognized body, including prompt text, out of the error', async () => {
    await expect(rejectRequest(400, 'private-conversation and secret-test-only'))
      .rejects.toThrow('AI 제공자가 요청을 처리하지 못했습니다. (HTTP 400)');
  });
});
