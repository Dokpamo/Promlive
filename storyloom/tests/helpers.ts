import {DatabaseSync} from 'node:sqlite';
import {SerialDatabase} from '../src/ports/storage';
import {migrate} from '../src/adapters/sqlite/migrations';
import {Repository} from '../src/adapters/sqlite/repository';
import type {AiProvider, AiEvent, AiRequest} from '../src/ports/ai';
export function nodeDatabase(file = ':memory:') {
  const sqlite = new DatabaseSync(file);
  const db = new SerialDatabase({
    async execute(sql, params = []) {
      const statement = sqlite.prepare(sql);
      if (statement.columns().length > 0) return {rows: statement.all(...params), changes: 0};
      const result = statement.run(...params); return {rows: [], changes: Number(result.changes)};
    },
    async close() { sqlite.close(); },
  });
  return db;
}
export async function repository(file = ':memory:') {const db = nodeDatabase(file); await migrate(db); return new Repository(db);}
export class FixtureProvider implements AiProvider {
  readonly id = 'test-only'; readonly label = 'Test fixture'; readonly connected = true;
  readonly research = true; readonly inputCharacterLimit = 12000;
  calls = 0; signal: AbortSignal | undefined;
  constructor(private readonly events: (signal: AbortSignal) => AsyncIterable<AiEvent> = async function* () {yield {type: 'delta', text: '테스트 응답'}; yield {type: 'done'};}) {}
  stream(_request: AiRequest, signal: AbortSignal) {this.calls++; this.signal = signal; return this.events(signal);}
}
