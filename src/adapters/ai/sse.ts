// Incremental SSE framing, independent of transport chunk boundaries.
export class SseDecoder {
  private line = '';
  private data: string[] = [];
  private eventSize = 0;
  private first = true;
  private afterCR = false;

  push(chunk: string): string[] {
    const events: string[] = [];
    for (let index = 0; index < chunk.length; index++) {
      const character = chunk[index]!;
      if (this.first) {this.first = false; if (character === '\uFEFF') continue;}
      if (this.afterCR) {this.afterCR = false; if (character === '\n') continue;}
      if (++this.eventSize > 512000) throw new Error('AI 스트림 이벤트가 너무 큽니다.');
      if (character !== '\r' && character !== '\n') {this.line += character; continue;}
      this.afterCR = character === '\r';
      if (this.line === '') {
        const data = this.data.join('\n');
        if (data) events.push(data);
        this.data = []; this.eventSize = 0;
      } else if (this.line.startsWith('data:')) {
        this.data.push(this.line.slice(5).replace(/^ /, ''));
      } else if (this.line === 'data') this.data.push('');
      this.line = '';
    }
    return events;
  }
}
