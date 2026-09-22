export type AiCatalogKind = 'chat' | 'image' | 'video' | 'audio' | 'voice';

export interface AiCatalogEntry {
  id: string;
  name: string;
  aliases: string[];
  inputModalities: string[];
  outputModalities: string[];
  reasoningEfforts?: string[];
  contextLength?: number;
  maxOutputTokens?: number;
  parameters?: string[];
  thinking?: boolean;
  adaptiveThinking?: boolean;
  tools?: ('web' | 'x' | 'files' | 'code')[];
}

/** Only these local messages reach the UI; upstream bodies may contain sensitive data. */
export class AiCatalogError extends Error {
  constructor(readonly code: 'key' | 'auth' | 'permission' | 'rate' | 'network' | 'timeout' | 'response' | 'endpoint' | 'connection' | 'unavailable' | 'workspace') {
    super({
      key: 'API 키를 입력하면 최신 목록을 확인할 수 있어요.',
      auth: 'API 키를 확인해 주세요. 인증에 실패했어요.',
      permission: '이 목록을 조회할 권한이 없어요. 연결 계정과 키의 권한을 확인해 주세요.',
      rate: '조회 요청이 많아요. 잠시 뒤 목록을 다시 열어 주세요.',
      network: '연결하지 못했어요. 기존 목록을 유지해요.',
      timeout: '응답이 늦어지고 있어요. 기존 목록을 유지해요.',
      response: '새 목록을 읽지 못했어요. 기존 목록을 유지해요.',
      endpoint: '이 연결에 맞는 API 주소를 확인해 주세요.',
      connection: '계정 로그인 연결은 준비 중이에요.',
      unavailable: '이 항목은 공식 문서 목록을 제공해요. 자동 조회는 지원하지 않아요.',
      workspace: '목록 조회에 필요한 Model Studio 워크스페이스 ID를 입력해 주세요.',
    }[code]);
    this.name = 'AiCatalogError';
  }
}
