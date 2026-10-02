import {expect, it} from 'vitest';
import {SseDecoder} from '../src/adapters/ai/sse';

it('decodes the same large stream identically as one chunk or many randomized chunks', () => {
  const event = 'data: ' + JSON.stringify({choices: [{delta: {content: '가🙂'}}], model: 'example', object: 'chat.completion.chunk'}) + '\n\n';
  const stream = event.repeat(8000);
  expect(stream.length).toBeGreaterThan(512000);
  const expected = new SseDecoder().push(stream); expect(expected).toHaveLength(8000);
  for (const seed of [1, 73, 431]) {
    let random = seed, offset = 0; const decoder = new SseDecoder(), actual: string[] = [];
    while (offset < stream.length) {
      random = (random * 1664525 + 1013904223) >>> 0;
      const size = 1 + random % 4000; actual.push(...decoder.push(stream.slice(offset, offset + size))); offset += size;
    }
    expect(actual).toEqual(expected);
  }
});
it('handles a leading BOM and CR, LF or CRLF even when every boundary is split', () => {
  const stream = '\uFEFF: comment\rdata: first\rdata: second\r\rdata: next\r\n\r\ndata: last\n\n';
  for (let split = 0; split <= stream.length; split++) {
    const decoder = new SseDecoder();
    expect([...decoder.push(stream.slice(0, split)), ...decoder.push(stream.slice(split))]).toEqual(['first\nsecond', 'next', 'last']);
  }
});
it('bounds both incomplete lines and complete lines belonging to a single oversized event', () => {
  for (const stream of ['data: ' + 'x'.repeat(512001), ('data: ' + 'x'.repeat(1000) + '\n').repeat(520)]) {
    expect(() => new SseDecoder().push(stream)).toThrow('너무 큽니다');
    const decoder = new SseDecoder();
    expect(() => {for (let i = 0; i < stream.length; i += 3000) decoder.push(stream.slice(i, i + 3000));}).toThrow('너무 큽니다');
  }
});
