import {cardWorkspaceReducer, type CardAction, type LibraryCard} from './cardWorkspace';
import type {GalleryImage} from './cardDetails';
import type {ScreenStorage} from './screenPersistence';
import {decodeScreenSnapshot, emptyScrollMemory, initialScreenData, initialScreenView, reconcileScreenData, validScreenData,
  type ScreenData, type ScreenSnapshot, type ScreenState, type ScreenView, type ScrollMemory, type ScrollScope} from './screenState';

/** Cache first, durable writes in order, then background reconciliation without a loading screen. */
export class ScreenMemory {
  private state: ScreenState;
  private positions: ScreenSnapshot['positions'];
  private listeners = new Set<() => void>();
  private revision = 0;
  private savedRevision = -1;
  private dataRevision = 0;
  private savedDataRevision = 0;
  private writing: Promise<void> | null = null;
  private refreshing: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly storage: ScreenStorage) {
    let cached: ScreenSnapshot | null = null;
    let failed = false;
    try { cached = decodeScreenSnapshot(storage.readSync()) ?? decodeScreenSnapshot(storage.readBackupSync()); }
    catch { failed = true; }
    this.state = {data: cached?.data ?? initialScreenData(), view: cached?.view ?? initialScreenView(), saveError: failed};
    this.positions = cached?.positions ?? {};
    if (cached) this.savedRevision = 0;
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  private emit() { this.listeners.forEach(listener => listener()); }
  private setSaveError(saveError: boolean) {
    if (this.state.saveError === saveError) return;
    this.state = {...this.state, saveError}; this.emit();
  }
  private changed() { this.revision++; this.emit(); void this.flush(); }

  updateView(update: (view: ScreenView) => ScreenView) {
    const view = update(this.state.view);
    if (view === this.state.view) return;
    this.state = {...this.state, view}; this.changed();
  }
  dispatchCard(action: CardAction) {
    const cards = cardWorkspaceReducer(this.state.data.cards, action);
    this.state = {...this.state, data: {...this.state.data, cards}};
    this.dataRevision++; this.changed();
  }
  ensureChat(card: LibraryCard) {
    if (this.state.data.chats.some(chat => chat.id === card.id)) return;
    const at = Date.now();
    const chat = {id: card.id, title: card.title, character: card.character, tile: card.tile,
      lastChatAt: at, lastAssistantMessage: card.introduction.replace(/\s+/g, ' ').trim(), draft: '', draftImage: null,
      messages: [{id: `${card.id}-intro`, role: 'assistant' as const, text: card.introduction, sentAt: at}]};
    this.state = {...this.state, data: {...this.state.data, chats: [chat, ...this.state.data.chats]}};
    this.dataRevision++; this.changed();
  }
  updateChatDraft(id: string, draft: string) {
    const current = this.state.data.chats.find(chat => chat.id === id);
    if (!current || current.draft === draft) return;
    this.state = {...this.state, data: {...this.state.data, chats: this.state.data.chats.map(chat => chat.id === id ? {...chat, draft} : chat)}};
    this.dataRevision++; this.changed();
  }
  sendChat(id: string, image?: GalleryImage) {
    const current = this.state.data.chats.find(chat => chat.id === id);
    image = image ?? current?.draftImage ?? undefined;
    if (!current || (!current.draft.trim() && !image)) return;
    const at = Date.now();
    const message = {id: `${id}-${at}-${this.revision}`, role: 'user' as const, text: current.draft.trim(), sentAt: at, ...(image ? {image} : {})};
    const updated = {...current, draft: '', draftImage: null, lastChatAt: at, messages: [...current.messages, message]};
    this.state = {...this.state, data: {...this.state.data, chats: [updated, ...this.state.data.chats.filter(chat => chat.id !== id)]}};
    this.dataRevision++; this.changed();
    return message;
  }
  updateChatImage(id: string, image: GalleryImage | null) {
    if (!this.state.data.chats.some(chat => chat.id === id)) return;
    this.state = {...this.state, data: {...this.state.data, chats: this.state.data.chats.map(chat => chat.id === id ? {...chat, draftImage: image} : chat)}};
    this.dataRevision++; this.changed();
  }
  getScroll = (scope: ScrollScope) => this.positions[scope] ?? emptyScrollMemory;
  rememberScroll = (scope: ScrollScope, position: ScrollMemory) => {
    if (JSON.stringify(this.positions[scope]) === JSON.stringify(position)) return;
    this.positions = {...this.positions, [scope]: {...position}};
    // Retain the tab-level snapshot for older readers, without mixing prepared filter pages.
    if (scope === `library:${this.state.view.libraryFilter}`) this.positions.library = {...position};
    if (scope === `create:${this.state.view.creationFilter}`) this.positions.create = {...position};
    this.revision++;
    // Scroll events never notify React or serialize the whole screen every frame.
    if (!this.timer) this.timer = setTimeout(() => {this.timer = null; void this.flush();}, 160);
  };
  resetScroll(scope: ScrollScope) { this.rememberScroll(scope, emptyScrollMemory); }

  flush = (): Promise<void> => {
    if (this.timer) {clearTimeout(this.timer); this.timer = null;}
    if (this.writing) return this.writing;
    if (this.savedRevision === this.revision) return Promise.resolve();
    this.writing = (async () => {
      while (this.savedRevision !== this.revision) {
        const revision = this.revision;
        const dataRevision = this.dataRevision;
        const snapshot: ScreenSnapshot = {version: 1, savedAt: Date.now(), data: this.state.data, view: this.state.view, positions: this.positions};
        try {
          await this.storage.write(JSON.stringify(snapshot));
          this.savedRevision = revision; this.savedDataRevision = dataRevision; this.setSaveError(false);
        } catch { this.setSaveError(true); break; }
      }
    })().finally(() => {this.writing = null;});
    return this.writing;
  };

  /** Later data services can supply a loader; the current app rechecks its local source. */
  refresh = (load?: () => Promise<ScreenData | null>): Promise<void> => {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      if (this.writing) await this.writing;
      // A failed write leaves a newer local draft than the persisted source.
      if (this.savedDataRevision !== this.dataRevision) return;
      const dataRevision = this.dataRevision;
      try {
        const incoming = load ? await load() : decodeScreenSnapshot(await this.storage.read())?.data;
        // A slow response must never replace a draft edited while it was in flight.
        if (!incoming || !validScreenData(incoming) || dataRevision !== this.dataRevision) return;
        const data = reconcileScreenData(this.state.data, incoming);
        if (data === this.state.data) return;
        let view = this.state.view;
        if (view.openedCardId && !data.cards.some(card => card.id === view.openedCardId)) view = {...view, openedCardId: null};
        if (view.detailCardId && !data.cards.some(card => card.id === view.detailCardId && card.published)) view = {...view, detailCardId: null, coverOpen: false};
        if (view.chatId && !data.chats.some(chat => chat.id === view.chatId)) view = {...view, chatId: null};
        this.state = {...this.state, data, view};
        this.dataRevision++; this.changed();
      } catch { /* Keep the last usable screen on refresh/network failure. */ }
    })().finally(() => {this.refreshing = null;});
    return this.refreshing;
  };
}
