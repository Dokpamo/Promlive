import type {Runtime} from './runtime';
import {Notifications} from './Notifications';
import {newCard, type Card} from '../features/cards/model';
import {CardEditor} from '../features/cards/CardEditor';
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
  page: Page = 'library'; filter: LibraryFilter = 'all'; search = '';
  cards: Card[] = [];
  readonly notifications = new Notifications();
  readonly cardEditor: CardEditor;
  readonly history: ConversationList;
  readonly chats: ChatSessions;

  constructor(readonly runtime: Runtime) {
    this.history = new ConversationList(runtime.repo, async ids => {
      await runtime.creation.deleteConversations(ids);
      this.chats.forget(ids);
    });
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
    const saved = await this.runtime.repo.insertCard({...card, id: copy.id, title: `${card.title.slice(0, 112)} 사본`, revision: 0, example: false, createdAt: copy.createdAt, updatedAt: copy.updatedAt});
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
  async startChat(card: Card, forceNew = false) {await this.startChatAt(card, forceNew, ++this.navigation);}
  private async startChatAt(card: Card, forceNew: boolean, attempt: number) {
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
