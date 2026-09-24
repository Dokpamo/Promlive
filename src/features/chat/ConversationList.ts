import {FolderLibrary, type FolderStore, type FolderRemoval} from '../library/FolderLibrary';
import type {Conversation} from './model';
import type {ConversationStore} from './store';

/** Owns history metadata and selection; message/draft lifetimes belong to ChatSessions. */
export class ConversationList {
  private list: Conversation[] = [];
  private selectedId: string | null = null;
  private revision = 0;
  private refreshRevision = 0;
  private listeners = new Set<() => void>();
  private deleted = new Set<string>();
  private opening = new Map<string, Promise<Conversation>>();
  private removingCards = new Set<string>();

  private readonly libraries = new Map<string, FolderLibrary>();
  folderLibrary(cardId: string) {
    if (!this.folderStore) return undefined;
    let library = this.libraries.get(cardId);
    if (!library) {library = new FolderLibrary({kind: 'history', cardId}, this.folderStore); this.libraries.set(cardId, library);}
    return library;
  }

  constructor(private readonly store: Pick<ConversationStore, 'conversations' | 'createConversation' | 'renameConversation' | 'pinConversation'>,
    private readonly removeStored: (ids: readonly string[], folders?: FolderRemoval) => Promise<void>,
    private readonly folderStore?: FolderStore) {}

  get items(): readonly Conversation[] {return this.list;}
  get selected(): Conversation | null {return this.list.find(item => item.id === this.selectedId) ?? null;}
  snapshot = () => this.revision;
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  private emit() {this.revision++; this.listeners.forEach(listener => listener());}

  async refresh() {
    const attempt = ++this.refreshRevision;
    const items = await this.store.conversations();
    if (attempt !== this.refreshRevision) return;
    this.list = items.filter(item => !this.deleted.has(item.id));
    this.emit();
  }

  select(conversation: Conversation) {
    if (this.deleted.has(conversation.id) || this.removingCards.has(conversation.cardId)) return false;
    // Keep refreshed titles/previews instead of replacing them with a stale row reference.
    if (!this.list.some(item => item.id === conversation.id)) this.list = [conversation, ...this.list];
    this.selectedId = conversation.id;
    this.emit();
    return true;
  }

  roomFor(cardId: string, forceNew = false): Promise<Conversation> {
    if (this.removingCards.has(cardId)) return Promise.reject(new Error('삭제 중인 카드입니다.'));
    const key = `${cardId}:${forceNew}`;
    const pending = this.opening.get(key);
    if (pending) return pending;
    const task = (async () => {
      const items = forceNew ? [] : await this.store.conversations(cardId);
      // Pinning affects list order, not the most recently used conversation.
      const recent = items.filter(item => !this.deleted.has(item.id)).reduce<Conversation | undefined>((latest, item) => !latest || item.updatedAt > latest.updatedAt ? item : latest, undefined);
      return recent ?? await this.store.createConversation(cardId);
    })().finally(() => {this.opening.delete(key);});
    this.opening.set(key, task);
    return task;
  }

  async rename(id: string, title: string) {
    await this.store.renameConversation(id, title);
    await this.refresh();
  }
  async pin(id: string, pinned: boolean) {
    await this.store.pinConversation(id, pinned);
    await this.refresh();
  }
  async remove(ids: readonly string[], folders?: FolderRemoval) {
    const unique = [...new Set(ids)];
    if (!unique.length && !folders?.folderIds.length) return;
    await this.removeStored(unique, folders);
    this.forget(unique);
    // Even if reloading fails, deleted rows/selection must stay removed locally.
    await this.refresh();
  }
  async removeCards(cardIds: readonly string[], removeStored: () => Promise<readonly string[]>) {
    cardIds.forEach(id => this.removingCards.add(id));
    try {
      // An already-started room creation must finish before the card cascade.
      await Promise.allSettled([...this.opening].filter(([key]) => cardIds.some(id => key.startsWith(`${id}:`))).map(([, task]) => task));
      const removed = await removeStored();
      cardIds.forEach(id => this.libraries.delete(id));
      this.forget([...removed, ...this.list.filter(item => cardIds.includes(item.cardId)).map(item => item.id)]);
    } finally {cardIds.forEach(id => this.removingCards.delete(id));}
  }
  private forget(ids: readonly string[]) {
    // Use the selection at completion: a room opened during deletion keeps ownership.
    const previous = this.selected;
    ids.forEach(id => this.deleted.add(id));
    this.refreshRevision++;
    this.list = this.list.filter(item => !this.deleted.has(item.id));
    if (previous && this.deleted.has(previous.id)) {
      this.selectedId = (this.list.find(item => item.cardId === previous.cardId) ?? this.list[0])?.id ?? null;
    }
    this.emit();
  }
}
