import type {z} from 'zod';
import type {sourceSchema} from '../features/cards/model';
export type Source = z.infer<typeof sourceSchema>;
export type AiPurpose = 'chat' | 'writing' | 'research' | 'creator';
export interface AiRequest {
  id: string; purpose: AiPurpose; instruction: string; context: string;
  messages: {role: 'user' | 'assistant'; content: string}[];
}
export type AiEvent = {type: 'delta'; text: string} | {type: 'source'; source: Source} | {type: 'done'};
export interface AiProvider {
  readonly id: string;
  readonly label: string;
  readonly connected: boolean;
  readonly research: boolean;
  readonly inputCharacterLimit: number;
  stream(request: AiRequest, signal: AbortSignal): AsyncIterable<AiEvent>;
}
// Credentials stay inside platform adapters. This reference is never a token or API key.
export interface AuthSession { providerId: string; credentialReference: string; expiresAt: number | null }
export interface CredentialStore { get(reference: string): Promise<string | null>; set(reference: string, secret: string): Promise<void>; remove(reference: string): Promise<void> }
export class AiUnavailableError extends Error { constructor() { super('AI가 아직 연결되지 않았습니다. 설정에서 연결 상태를 확인해 주세요.'); this.name = 'AiUnavailableError'; } }
