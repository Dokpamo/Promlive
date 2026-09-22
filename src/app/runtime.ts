import {openDatabase} from '../adapters/sqlite/open';
import {migrate} from '../adapters/sqlite/migrations';
import {Repository} from '../adapters/sqlite/repository';
import {SelectedProvider} from '../adapters/ai/selectedProvider';
import {XhrTransport} from '../adapters/ai/xhrTransport';
import {credentialStore} from '../adapters/credentials/store';
import {AiSettingsPreferences} from '../features/settings/aiSettingsPreferences';
import {SummaryExtensions} from '../extensions/SummaryExtensions';
import {SqliteExtensionStore} from '../adapters/sqlite/extensionStore';
import {GenerationCoordinator} from '../features/chat/generation';
import {CreationService} from '../features/chat/service';
import type {AiProvider} from '../ports/ai';
import type {StoryRepository} from '../ports/repository';
export interface Runtime { repo: StoryRepository; creation: CreationService; provider: AiProvider; aiPreferences?: AiSettingsPreferences; extensions?: SummaryExtensions }
let boot: Promise<Runtime> | undefined;
export function initialize(): Promise<Runtime> {
  boot ??= (async () => {
    const db = await openDatabase();
    try {
      await migrate(db);
      const repo = new Repository(db);
      await repo.recoverInterrupted();
      const aiPreferences = new AiSettingsPreferences(repo, credentialStore);
      await aiPreferences.load();
      const provider = new SelectedProvider(aiPreferences, credentialStore, new XhrTransport());
      const coordinator = new GenerationCoordinator(provider);
      const extensions = new SummaryExtensions(new SqliteExtensionStore(db), repo, coordinator);
      await extensions.load();
      return {repo, provider, creation: new CreationService(repo, coordinator), aiPreferences, extensions};
    } catch (error) { await db.close(); throw error; }
  })();
  return boot;
}
