import {openDatabase} from '../adapters/sqlite/open';
import {migrate} from '../adapters/sqlite/migrations';
import {Repository} from '../adapters/sqlite/repository';
import {DisconnectedProvider} from '../adapters/ai/disconnected';
import {GenerationCoordinator} from '../features/chat/generation';
import {CreationService} from '../features/chat/service';
import type {AiProvider} from '../ports/ai';
import type {StoryRepository} from '../ports/repository';
export interface Runtime { repo: StoryRepository; creation: CreationService; provider: AiProvider }
let boot: Promise<Runtime> | undefined;
export function initialize(): Promise<Runtime> {
  boot ??= (async () => {
    const db = await openDatabase();
    try {
      await migrate(db);
      const repo = new Repository(db);
      await repo.recoverInterrupted();
      const provider = new DisconnectedProvider();
      return {repo, provider, creation: new CreationService(repo, new GenerationCoordinator(provider))};
    } catch (error) { await db.close(); throw error; }
  })();
  return boot;
}
