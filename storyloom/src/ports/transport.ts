export interface TextStreamRequest {url: string; headers: Record<string, string>; body: string}
export interface TextStreamTransport {stream(request: TextStreamRequest, signal: AbortSignal): AsyncIterable<string>}
