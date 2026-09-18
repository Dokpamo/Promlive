import {describe, expect, it} from 'vitest';
import {SseDecoder} from '../src/adapters/ai/sse';
import {GrokProvider} from '../src/adapters/ai/grok';
import {GenerationCoordinator} from '../src/features/chat/generation';
import type {TextStreamTransport, TextStreamRequest} from '../src/ports/transport';
import type {AiEvent, AiRequest} from '../src/ports/ai';
const request: AiRequest = {id: 'xai-test', purpose: 'chat', context: '테스트 카드', instruction: '안녕', messages: []};
const credentials = {get: async () => 'test-only-credential', set: async () => {}, remove: async () => {}};
describe('Grok wire format, tested without any external request', () => {
  it('decodes fragmented CRLF, multi-line and comment SSE frames', () => {
    const decoder = new SseDecoder();
    expect(decoder.push(': heartbeat\r\n\r\ndata: 첫째\r')).toEqual([]);
    expect(decoder.push('\ndata: 둘째\r\n\r\n')).toEqual(['첫째\n둘째']);
  });
  it('keeps Unicode order across transport chunks and completes only on DONE', async () => {
    let sent: TextStreamRequest | undefined;
    const transport: TextStreamTransport = {async *stream(input) {sent = input; yield 'data: {"choices":[{"delta":{"content":"별빛"},"finish_reason":null}]}\n'; yield '\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';}};
    const provider = new GrokProvider({model: 'model-selected-at-connection', credentialReference: 'host-owned', inputCharacterLimit: 12000}, credentials, transport);
    const events: AiEvent[] = []; await new GenerationCoordinator(provider).run(request, event => {events.push(event);});
    expect(events).toEqual([{type: 'delta', text: '별빛'}, {type: 'done'}]);
    expect(sent?.url).toBe('https://api.x.ai/v1/chat/completions'); expect(sent?.body).not.toContain('test-only-credential');
  });
  it('does not reinterpret token exhaustion or EOF as normal completion', async () => {
    const limited: TextStreamTransport = {async *stream() {yield 'data: {"choices":[{"delta":{"content":"부분"},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n';}};
    const provider = new GrokProvider({model: 'test', credentialReference: 'test', inputCharacterLimit: 12000}, credentials, limited);
    await expect(new GenerationCoordinator(provider).run(request, () => {})).rejects.toThrow('길이');
    const eof: TextStreamTransport = {async *stream() {yield 'data: {"choices":[{"delta":{"content":"부분"},"finish_reason":null}]}\n\n';}};
    await expect(new GenerationCoordinator(new GrokProvider({model: 'test', credentialReference: 'test', inputCharacterLimit: 12000}, credentials, eof)).run(request, () => {})).rejects.toThrow('완료 신호');
  });
});
