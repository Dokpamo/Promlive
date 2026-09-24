import {FolderLibrary, type FolderRemoval} from '../features/library/FolderLibrary';
import type {Runtime} from './runtime';
import {Notifications} from './Notifications';
import {newCard, type Card} from '../features/cards/model';
import {CardEditor} from '../features/cards/CardEditor';
import type {CardListActions, CardMetadataPatch} from '../features/cards/store';
import type {Conversation} from '../features/chat/model';
import {ChatSessions} from '../features/chat/ChatSession';
import {ConversationList} from '../features/chat/ConversationList';
export type Page = 'library' | 'editor' | 'chat' | 'settings';
export type LibraryFilter = 'all' | 'favorites' | 'archived';

/** App navigation/composition. Feature owners hold edits, histories and messages. */
export class Workspace {
  private listeners = new Set<() => void>();
  private version = 0;
  private navigation = 0;
  private refreshVersion = 0;
  private generalOpening: Promise<Card> | undefined;
  private removingCards = new Set<string>();
  private cardRemoval: Promise<void> = Promise.resolve();
  page: Page = 'library'; filter: LibraryFilter = 'all'; search = '';
  cards: Card[] = [];
  readonly notifications = new Notifications();
  readonly cardEditor: CardEditor;
  readonly history: ConversationList;
  readonly chats: ChatSessions;
  readonly cardFolders: FolderLibrary;
  readonly cardActions: CardListActions;
  private createCardActions(): CardListActions {return {
    folders: this.cardFolders,
    rename: (id, title) => this.changeCardMetadata(id, {title}),
    pin: (id, pinned) => this.changeCardMetadata(id, {pinnedAt: pinned ? Date.now() : null}),
    remove: (ids, folders) => {
      const task = this.cardRemoval.then(() => this.removeCards([...new Set(ids)], folders));
      this.cardRemoval = task.catch(() => {});
      return task;
    },
  };}

  constructor(readonly runtime: Runtime) {
    this.cardFolders = new FolderLibrary({kind: 'card'}, runtime.repo.folderStore);
    this.cardActions = this.createCardActions();
    this.history = new ConversationList(runtime.repo, async (ids, folders) => {
      await runtime.creation.deleteConversations(ids, folders);
      this.chats.forget(ids);
    }, runtime.repo.folderStore);
    this.cardEditor = new CardEditor(runtime.repo, {
      report: this.notifications.report,
      committed: async (card, draft) => {
        if (draft) runtime.creation.markDraftApplied(card.id, draft.id);
        await this.refreshCards();
        this.notifications.inform(draft ? '초안을 카드에 적용했어요.' : '이야기를 기기에 저장했어요.');
      },
    });
    this.chats = new ChatSessions(runtime.repo, runtime.creation, (error, offline) => {
      if (error) this.notifications.report(error);
      else {
        void this.history.refresh().catch(this.notifications.report);
        if (offline) this.notifications.inform('AI 연결 전이에요. 메시지는 이 기기에만 저장했어요.');
      }
    });
  }
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  snapshot = () => this.version;
  private emit() {this.version++; this.listeners.forEach(listener => listener());}
  async ready() {await this.refresh();}
  private generalCard(): Promise<Card> {
    if (this.removingCards.has('promlive-general-chat')) return Promise.reject(new Error('삭제 중인 카드입니다.'));
    const existing = this.cards.find(card => card.id === 'promlive-general-chat');
    if (existing) return Promise.resolve(existing);
    this.generalOpening ??= this.runtime.repo.insertCard({...newCard(), id: 'promlive-general-chat', title: 'Promlive', genre: '', description: ''})
      .catch(error => {this.generalOpening = undefined; throw error;});
    return this.generalOpening;
  }
  async readyChat() {await this.ready(); await this.newGeneralChat(false);}
  async newGeneralChat(forceNew = true) {
    const attempt = ++this.navigation;
    const card = await this.generalCard();
    if (attempt === this.navigation) await this.startChatAt(card, forceNew, attempt);
  }
  async refresh() {await Promise.all([this.refreshCards(), this.history.refresh()]);}
  private async refreshCards() {
    const version = ++this.refreshVersion;
    const cards = await this.runtime.repo.listCards();
    if (version !== this.refreshVersion) return;
    this.cards = cards; this.emit();
  }
  async go(page: Page) {
    const attempt = ++this.navigation;
    await this.cardEditor.flush();
    if (attempt === this.navigation) {this.page = page; this.emit();}
  }
  setFilter(filter: LibraryFilter) {this.navigation++; this.filter = filter; this.page = 'library'; this.emit();}
  setSearch(value: string) {this.search = value; this.emit();}
  async create(kind: Card['body']['kind']) {
    const attempt = ++this.navigation;
    const card = await this.runtime.repo.insertCard(newCard(kind));
    await this.refreshCards();
    await this.openAt(card.id, attempt);
  }
  async open(id: string) {await this.openAt(id, ++this.navigation);}
  private async openAt(id: string, attempt: number) {
    if (attempt !== this.navigation) return;
    const opened = await this.cardEditor.open(id, () => attempt === this.navigation);
    if (opened) {this.page = 'editor'; this.emit();}
  }
  async duplicate(card: Card) {
    const attempt = ++this.navigation;
    const copy = newCard(card.body.kind);
    const saved = await this.runtime.repo.insertCard({...card, id: copy.id, title: `${card.title.slice(0, 112)} 사본`, revision: 0, example: false, pinnedAt: null, createdAt: copy.createdAt, updatedAt: copy.updatedAt});
    await this.refreshCards(); await this.openAt(saved.id, attempt);
    this.notifications.inform('별도의 카드로 복제했어요.');
  }
  async favorite(card: Card) {
    await this.cardEditor.flush();
    const latest = await this.runtime.repo.getCard(card.id);
    const saved = await this.runtime.repo.updateMetadata(card.id, {favorite: !latest.favorite});
    this.cardEditor.updateMetadata(saved);
    await this.refreshCards();
  }
  async archive(card: Card) {
    const attempt = ++this.navigation;
    await this.cardEditor.flush();
    const latest = await this.runtime.repo.getCard(card.id);
    const saved = await this.runtime.repo.updateMetadata(card.id, {archived: !latest.archived});
    this.cardEditor.updateMetadata(saved);
    if (attempt === this.navigation) {this.cardEditor.close(saved.id); this.page = 'library'; this.emit();}
    await this.refreshCards();
    this.notifications.inform(saved.archived ? '보관함으로 옮겼어요.' : '서재로 다시 가져왔어요.');
  }
  private async changeCardMetadata(id: string, patch: CardMetadataPatch) {
    if (this.removingCards.has(id)) throw new Error('삭제 중인 카드입니다.');
    await this.cardEditor.settle();
    const saved = await this.runtime.repo.updateMetadata(id, patch);
    this.cardEditor.updateMetadata(saved, patch);
    await this.refreshCards();
  }
  private async removeCards(ids: readonly string[], folders?: FolderRemoval) {
    if (!ids.length && !folders?.folderIds.length) return;
    const attempt = ++this.navigation;
    ids.forEach(id => this.removingCards.add(id));
    try {
      if (ids.includes('promlive-general-chat')) await this.generalOpening;
      await this.history.removeCards(ids, () => this.cardEditor.withRemoval(ids, async () => {
        for (const room of this.history.items) if (ids.includes(room.cardId)) this.runtime.extensions?.cancel(room.id);
        const removed = await this.runtime.creation.deleteCards(ids, folders);
        this.chats.forget(removed);
        this.refreshVersion++;
        this.cards = this.cards.filter(card => !ids.includes(card.id));
        if (ids.includes('promlive-general-chat')) this.generalOpening = undefined;
        if (attempt === this.navigation && this.page === 'editor' && ids.includes(this.cardEditor.state?.card.id ?? '')) this.page = 'library';
        this.emit();
        return removed;
      }));
      await this.refresh();
    } finally {ids.forEach(id => this.removingCards.delete(id));}
  }
  async startChat(card: Card, forceNew = false) {await this.startChatAt(card, forceNew, ++this.navigation);}
  private async startChatAt(card: Card, forceNew: boolean, attempt: number) {
    if (this.removingCards.has(card.id)) throw new Error('삭제 중인 카드입니다.');
    const editor = this.cardEditor.state;
    if (editor?.card.id === card.id && editor.dirty) await this.cardEditor.save();
    else await this.cardEditor.flush();
    if (attempt !== this.navigation) return;
    const conversation = await this.history.roomFor(card.id, forceNew);
    if (attempt !== this.navigation) {await this.history.refresh(); return;}
    if (this.history.select(conversation)) {this.page = 'chat'; this.emit();}
    await this.refresh();
  }
  async openConversation(conversation: Conversation) {
    const attempt = ++this.navigation;
    await this.cardEditor.flush();
    if (attempt === this.navigation && this.history.select(conversation)) {this.page = 'chat'; this.emit();}
  }
}
