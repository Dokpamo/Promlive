import type {StoryRepository} from '../../ports/repository';
import type {Message} from './model';

const PAGE_SIZE = 40;
interface MessagePage {
  messages: Message[];
  hasMore: boolean;
  loadingOlder: boolean;
}

function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map(message => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
}

/** One conversation's loaded range. Refreshes extend it; they never discard older pages. */
export class MessageHistory {
  private state: MessagePage = {messages: [], hasMore: false, loadingOlder: false};
  private initialized = false;
  private listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();
  private olderRequest: Promise<void> | undefined;

  constructor(private repo: StoryRepository, private conversationId: string | undefined) {}

  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {this.listeners.delete(listener);};
  };

  private update(patch: Partial<MessagePage>) {
    this.state = {...this.state, ...patch};
    this.listeners.forEach(listener => listener());
  }

  private enqueue(work: () => Promise<void>) {
    const result = this.queue.then(work);
    // A failed read must not block subsequent refreshes or pagination retries.
    this.queue = result.catch(() => {});
    return result;
  }

  refresh = () => this.enqueue(async () => {
    if (!this.conversationId) return;
    let page = await this.repo.messages(this.conversationId, undefined, PAGE_SIZE + 1);
    const last = this.state.messages.at(-1);
    if (!this.initialized || !last) {
      this.initialized = true;
      this.update({messages: page.slice(-PAGE_SIZE), hasMore: page.length > PAGE_SIZE});
      return;
    }

    let incoming = page;
    // Bridge every page when several messages arrived while the view was away.
    while (page.length > PAGE_SIZE && page[0]!.sequence > last.sequence) {
      page = await this.repo.messages(this.conversationId, page[0]!.sequence, PAGE_SIZE + 1);
      incoming = [...page, ...incoming];
    }
    const first = this.state.messages[0]!.sequence;
    this.update({messages: mergeMessages(this.state.messages, incoming.filter(message => message.sequence >= first))});
  });

  loadOlder = (): Promise<void> => {
    if (this.olderRequest) return this.olderRequest;
    this.update({loadingOlder: true});
    this.olderRequest = this.enqueue(async () => {
      const first = this.state.messages[0];
      if (!this.conversationId || !this.state.hasMore || !first) return;
      const page = await this.repo.messages(this.conversationId, first.sequence, PAGE_SIZE + 1);
      this.update({
        messages: mergeMessages(this.state.messages, page.slice(-PAGE_SIZE)),
        hasMore: page.length > PAGE_SIZE,
      });
    }).finally(() => {
      this.olderRequest = undefined;
      this.update({loadingOlder: false});
    });
    return this.olderRequest;
  };
}
