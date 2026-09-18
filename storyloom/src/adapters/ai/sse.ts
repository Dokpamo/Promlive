// Incremental SSE framing; chunks need not align with lines or complete JSON objects.
export class SseDecoder {
  private buffer = '';
  push(chunk: string): string[] {
    this.buffer += chunk;
    if (this.buffer.length > 512000) throw new Error('AI 스트림 이벤트가 너무 큽니다.');
    const events: string[] = [];
    while (true) {
      const boundary = /\r?\n\r?\n/.exec(this.buffer);
      if (!boundary) break;
      const frame = this.buffer.slice(0, boundary.index);
      this.buffer = this.buffer.slice(boundary.index + boundary[0].length);
      const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
      if (data) events.push(data);
    }
    return events;
  }
}
