import type {SummaryProgram} from './summaryProgram';

export interface ExtensionVersion {version: number; program: SummaryProgram; createdAt: number}
export interface SummaryExtension {
  revision: number; executionRevision: number; activeVersion: number | null; draftVersion: number | null; enabled: boolean;
  grants: string[]; versions: ExtensionVersion[];
}
export interface SummaryResult {id: string; conversationId: string; version: number; content: string; throughSequence: number; messageCount: number; createdAt: number}
export interface ExtensionStore {
  load(): Promise<SummaryExtension>;
  stage(program: SummaryProgram, expectedRevision: number): Promise<SummaryExtension>;
  activate(version: number, expectedRevision: number, grants: readonly string[]): Promise<SummaryExtension>;
  disable(expectedRevision: number): Promise<SummaryExtension>;
  saveResult(result: SummaryResult, expectedRevision: number): Promise<void>;
  results(conversationId: string): Promise<SummaryResult[]>;
}
