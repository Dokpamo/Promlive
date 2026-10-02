import {cardWorkspaceReducer, type CardAction, type LibraryCard} from './cardWorkspace';
import type {GalleryImage} from './cardDetails';
import {ScreenStorageConflict, type ScreenStorage} from './screenPersistence';
import {decodeScreenView, inspectScreenSnapshot, emptyScrollMemory, initialScreenData, initialScreenView, reconcileScreenData, validScreenData,
  type ScreenData, type ScreenSnapshot, type ScreenState, type ScreenView, type ScrollMemory, type ScrollScope, type ScreenStorageIssue} from './screenState';

/** Cache first, durable writes in order, then background reconciliation without a loading screen. */
export class ScreenMemory {
  private state: ScreenState;
  private positions: ScreenSnapshot['positions'];
  private listeners = new Set<() => void>();
  private revision = 0;
  private savedRevision = -1;
  private dataRevision = 0;
  private savedDataRevision = -1;
  private source: string | null = null;
  private blockedLoad = false;
  private writing: Promise<boolean> | null = null;
  private refreshing: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly storage: ScreenStorage) {
    let cached: ScreenSnapshot | null = null;
    let issue: ScreenStorageIssue | null = null;
    try {
      this.source = storage.readSync();
      const primary = inspectScreenSnapshot(this.source);
      if (primary.kind === 'valid') {cached = primary.snapshot; this.savedDataRevision = 0;}
      else if (primary.kind === 'unsupported') issue = 'unsupported';
      else {
        const backup = inspectScreenSnapshot(storage.readBackupSync());
        if (backup.kind === 'valid') cached = backup.snapshot;
        else if (primary.kind !== 'empty' || backup.kind !== 'empty') issue = backup.kind === 'unsupported' ? 'unsupported' : 'corrupt';
      }
    } catch {issue = 'read';}
    this.blockedLoad = issue !== null;
    const data = cached?.data ?? (issue ? {cards: [], chats: []} : initialScreenData());
    let presentation = cached && {view: cached.view, positions: cached.positions};
    try {presentation = decodeScreenView(storage.readViewSync(), data) ?? presentation;} catch {issue ??= 'read';}
    this.state = {data, view: presentation?.view ?? initialScreenView(), saveError: issue !== null, storageIssue: issue};
    this.positions = presentation?.positions ?? {};
    if (cached && this.savedDataRevision === 0) this.savedRevision = 0;
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  private emit() { this.listeners.forEach(listener => listener()); }
  private setSaveError(storageIssue: ScreenStorageIssue | null) {
    if (this.state.storageIssue === storageIssue) return;
    this.state = {...this.state, saveError: storageIssue !== null, storageIssue}; this.emit();
  }
  private changed() { this.revision++; this.emit(); void this.flush(); }

  updateView(update: (view: ScreenView) => ScreenView) {
    const view = update(this.state.view);
    if (view === this.state.view) return;
    this.state = {...this.state, view}; this.changed();
  }
  dispatchCard(action: CardAction) {
    if (this.blockedLoad) return;
    const cards = cardWorkspaceReducer(this.state.data.cards, action);
    this.state = {...this.state, data: {...this.state.data, cards}};
    this.dataRevision++; this.changed();
  }
  ensureChat(card: LibraryCard) {
    if (this.blockedLoad) return;
    if (this.state.data.chats.some(chat => chat.id === card.id)) return;
    const at = Date.now();
    const chat = {id: card.id, title: card.title, character: card.character, tile: card.tile,
      lastChatAt: at, lastAssistantMessage: card.introduction.replace(/\s+/g, ' ').trim(), draft: '', draftImage: null,
      messages: [{id: `${card.id}-intro`, role: 'assistant' as const, text: card.introduction, sentAt: at}]};
    this.state = {...this.state, data: {...this.state.data, chats: [chat, ...this.state.data.chats]}};
    this.dataRevision++; this.changed();
  }
  updateChatDraft(id: string, draft: string) {
    if (this.blockedLoad) return;
    const current = this.state.data.chats.find(chat => chat.id === id);
    if (!current || current.draft === draft) return;
    this.state = {...this.state, data: {...this.state.data, chats: this.state.data.chats.map(chat => chat.id === id ? {...chat, draft} : chat)}};
    this.dataRevision++; this.changed();
  }
  sendChat(id: string, image?: GalleryImage) {
    if (this.blockedLoad) return;
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
    if (this.blockedLoad) return;
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

  flush = async (): Promise<void> => {
    if (this.timer) {clearTimeout(this.timer); this.timer = null;}
    if (this.blockedLoad) return;
    while (this.savedRevision !== this.revision) {
      if (!this.writing) this.writing = Promise.resolve().then(async () => {
        const revision = this.revision;
        const dataRevision = this.dataRevision;
        const data = this.state.data;
        const presentation = JSON.stringify({version: 1, view: this.state.view, positions: this.positions});
        try {
          if (this.savedDataRevision !== dataRevision) {
            const content = JSON.stringify({version: 1, savedAt: Date.now(), data});
            await this.storage.write(content, this.source);
            this.source = content; this.savedDataRevision = dataRevision;
          }
          await this.storage.writeView(presentation);
          this.savedRevision = revision; this.setSaveError(null);
          return true;
        } catch (error) {this.setSaveError(error instanceof ScreenStorageConflict ? 'conflict' : 'write'); return false;}
        finally {this.writing = null;}
      });
      if (!await this.writing) return;
      // Recheck after the worker settles as edits can arrive in its final microtask.
    }
  };

  /** Later data services can supply a loader; the current app rechecks its local source. */
  refresh = (load?: () => Promise<ScreenData | null>): Promise<void> => {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      if (this.writing) await this.writing;
      // A failed write leaves a newer local draft than the persisted source.
      if (!this.blockedLoad && this.savedDataRevision !== this.dataRevision && this.dataRevision > 0) return;
      const dataRevision = this.dataRevision;
      try {
        let incoming: ScreenData | null;
        let raw: string | null = this.source;
        let repair = false;
        if (load) incoming = await load();
        else {
          raw = await this.storage.read();
          const result = inspectScreenSnapshot(raw);
          if (result.kind === 'valid') incoming = result.snapshot.data;
          else {
            if (!this.blockedLoad) return;
            if (result.kind === 'unsupported') {this.setSaveError('unsupported'); return;}
            const backup = inspectScreenSnapshot(this.storage.readBackupSync());
            if (backup.kind === 'valid') incoming = backup.snapshot.data;
            else if (result.kind === 'empty' && backup.kind === 'empty') incoming = initialScreenData();
            else {this.setSaveError(backup.kind === 'unsupported' ? 'unsupported' : 'corrupt'); return;}
            // A successful retry may prove this really is a new installation,
            // or recover a backup that was unreadable on the first attempt.
            repair = true;
          }
        }
        // A slow response must never replace a draft edited while it was in flight.
        if (!incoming || !validScreenData(incoming) || dataRevision !== this.dataRevision) return;
        if (!load) {
          this.source = raw; this.savedDataRevision = repair ? -1 : this.dataRevision;
          if (this.blockedLoad) {this.blockedLoad = false; this.setSaveError(null);}
        }
        const data = reconcileScreenData(this.state.data, incoming);
        if (data === this.state.data) return;
        let view = this.state.view;
        if (view.openedCardId && !data.cards.some(card => card.id === view.openedCardId)) view = {...view, openedCardId: null};
        if (view.detailCardId && !data.cards.some(card => card.id === view.detailCardId && card.published)) view = {...view, detailCardId: null, coverOpen: false};
        if (view.chatId && !data.chats.some(chat => chat.id === view.chatId)) view = {...view, chatId: null};
        this.state = {...this.state, data, view};
        this.dataRevision++;
        if (!load && !repair) this.savedDataRevision = this.dataRevision;
        this.changed();
      } catch { /* Keep the last usable screen on refresh/network failure. */ }
    })().finally(() => {this.refreshing = null;});
    return this.refreshing;
  };
}
