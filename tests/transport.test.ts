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
    const provider = new GrokProvider({model: 'model-selected-at-connection', credentialReference: 'host-owned', inputCharacterLimit: 12000, maxOutputTokens: 10000}, credentials, transport);
    const events: AiEvent[] = []; await new GenerationCoordinator(provider).run(request, event => {events.push(event);});
    expect(events).toEqual([{type: 'delta', text: '별빛'}, {type: 'done'}]);
    expect(sent?.url).toBe('https://api.x.ai/v1/chat/completions'); expect(sent?.body).not.toContain('test-only-credential');
    expect(JSON.parse(sent!.body).max_completion_tokens).toBe(10000);
  });
  it('does not reinterpret token exhaustion or EOF as normal completion', async () => {
    let requests = 0;
    const limited: TextStreamTransport = {async *stream() {requests++; yield 'data: {"choices":[{"delta":{"content":"부분"},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n';}};
    const provider = new GrokProvider({model: 'test', credentialReference: 'test', inputCharacterLimit: 12000, maxOutputTokens: 10000}, credentials, limited);
    const events: AiEvent[] = [];
    await expect(new GenerationCoordinator(provider).run(request, event => {events.push(event);})).rejects.toThrow('길이');
    expect(events).toEqual([{type: 'delta', text: '부분'}]);
    expect(requests).toBe(1);
    const eof: TextStreamTransport = {async *stream() {yield 'data: {"choices":[{"delta":{"content":"부분"},"finish_reason":null}]}\n\n';}};
    await expect(new GenerationCoordinator(new GrokProvider({model: 'test', credentialReference: 'test', inputCharacterLimit: 12000, maxOutputTokens: 10000}, credentials, eof)).run(request, () => {})).rejects.toThrow('완료 신호');
  });
  it('requests structured output for authoring without changing the chat request format', async () => {
    const sent: TextStreamRequest[] = [];
    const transport: TextStreamTransport = {async *stream(input) {sent.push(input); yield 'data: {"choices":[{"delta":{"content":"{}"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';}};
    const coordinator = new GenerationCoordinator(new GrokProvider({model: 'test', credentialReference: 'host-owned', inputCharacterLimit: 12000, maxOutputTokens: 10000}, credentials, transport));
    const schema = {type: 'object', additionalProperties: false, properties: {kind: {type: 'string'}}, required: ['kind']};
    await coordinator.run({...request, id: 'studio', purpose: 'authoring', outputSchema: schema}, () => {});
    await coordinator.run({...request, id: 'chat'}, () => {});
    expect(JSON.parse(sent[0]!.body).response_format).toEqual({type: 'json_schema', json_schema: {name: 'promlive_authoring', strict: true, schema}});
    expect(JSON.parse(sent[1]!.body).response_format).toBeUndefined();
    expect(sent[0]!.body).not.toContain('test-only-credential');
  });
  it('does not send a model that cannot enforce the token limit', async () => {
    let requests = 0;
    const transport: TextStreamTransport = {async *stream() {requests++; yield '';}};
    const provider = new GrokProvider({model: 'grok-4.20-multi-agent', credentialReference: 'test', inputCharacterLimit: 12000, maxOutputTokens: 10000}, credentials, transport);
    await expect(new GenerationCoordinator(provider).run(request, () => {})).rejects.toThrow('생성 토큰 상한을 지원하지 않아');
    expect(requests).toBe(0);
  });
});
