import type {ChatRow, CardAction, LibraryCard, GalleryImage, ChatMessage} from '../../features/workspace/model';
import type {ScreenMemoryController} from '../ScreenController';
import {ScreenStorageConflict, type ScreenStorage} from '../../ports/screenStorage';
import {inspectScreenSnapshot, inspectScreenView, decodeScreenSnapshot, validScreenData, emptyScrollMemory, initialScreenData, initialScreenView, type ScreenData, type ScreenView, type ScreenState, type ScreenSnapshot, type ScrollScope, type ScrollMemory, type ScreenStorageIssue} from '../screenState';
import {cardWorkspaceReducer} from '../cardWorkspace';
import {WorkspaceCollection} from './Collection';
import {WorkspaceRoom} from './Room';
import {workspaceTuning as tuning} from './tuning';
import type {WorkspaceCache, WorkspaceStorage, CollectionQuery, CollectionRow, WorkspaceSeed} from '../../ports/workspace';

type PendingWrite = {key: string; run: () => Promise<void>};
type Cache = {version: 2; snapshot: ScreenSnapshot; collections: Array<{query: CollectionQuery; rows: CollectionRow[]}>; revisions: Array<[string, number]>};

/** Durable rows are authoritative. Only a bounded, disposable viewport snapshot boots synchronously. */
export class WorkspaceMemory implements ScreenMemoryController {
  readonly workspace = this;
  private state: ScreenState = {data: {cards: [], chats: []}, view: initialScreenView(), saveError: false, storageIssue: null};
  private positions: ScreenSnapshot['positions'] = {};
  private listeners = new Set<() => void>();
  private collections = new Map<string, WorkspaceCollection>();
  private cachedCollections: Cache['collections'] = [];
  private rooms = new Map<string, WorkspaceRoom>();
  private revisions = new Map<string, number>();
  private pending: PendingWrite[] = [];
  private activeWrite: PendingWrite | null = null;
  private writing: Promise<void> | null = null;
  private initializing: Promise<void> | null = null;
  private initialized = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private cacheDirty = false;
  private cacheLoaded = false;
  private viewChanged = false;
  private counter = 0;
  private viewRequest = 0;

  constructor(private legacy: ScreenStorage, readonly store: WorkspaceStorage, private cache: WorkspaceCache) {
    try {
      const raw = cache.read();
      if (raw && raw.length <= tuning.cacheCharacters * 2) {
        const saved = JSON.parse(raw) as Cache;
        const snapshot = saved.version === 2 ? decodeScreenSnapshot(JSON.stringify(saved.snapshot), true) : null;
        if (snapshot) {
          this.state = {...this.state, data: snapshot.data, view: snapshot.view}; this.positions = snapshot.positions;
          this.cachedCollections = Array.isArray(saved.collections) ? saved.collections.filter(item => item && item.query &&
            ['library', 'create', 'chats'].includes(item.query.scope) && typeof item.query.filter === 'string' && typeof item.query.search === 'string' &&
            Array.isArray(item.rows) && item.rows.every(row => row && typeof row.id === 'string' && Number.isFinite(row.sort) &&
              validScreenData(item.query.scope === 'chats' ? {cards: [], chats: [row.value]} : {cards: [row.value], chats: []})))
            .slice(0, tuning.cachedCollections) : [];
          this.revisions = new Map(Array.isArray(saved.revisions) ? saved.revisions.filter(entry => Array.isArray(entry) &&
            typeof entry[0] === 'string' && Number.isSafeInteger(entry[1]) && entry[1] >= 0) : []); this.cacheLoaded = true;
        }
      }
    } catch { /* A missing/corrupt derived cache must never reset the authoritative store. */ }
  }
  getSnapshot = () => this.state;
  subscribe = (callback: () => void) => {this.listeners.add(callback); return () => {this.listeners.delete(callback);};};
  private emit() {this.listeners.forEach(callback => callback());}
  private issue(storageIssue: ScreenStorageIssue | null) {
    if (this.state.storageIssue === storageIssue) return;
    this.state = {...this.state, saveError: storageIssue !== null, storageIssue}; this.emit();
  }
  private async seed(): Promise<WorkspaceSeed> {
    const raw = await this.legacy.read();
    const primary = inspectScreenSnapshot(raw);
    if (primary.kind === 'unsupported') {this.issue('unsupported'); throw new Error('Unsupported legacy workspace');}
    const backup = primary.kind === 'valid' ? null : inspectScreenSnapshot(this.legacy.readBackupSync());
    const snapshot = primary.kind === 'valid' ? primary.snapshot : backup?.kind === 'valid' ? backup.snapshot : null;
    if (!snapshot && (primary.kind !== 'empty' || backup?.kind !== 'empty')) {this.issue('corrupt'); throw new Error('Unreadable legacy workspace');}
    const data = snapshot?.data ?? initialScreenData();
    const presentation = inspectScreenView(this.legacy.readViewSync(), data);
    if (presentation.kind === 'corrupt' || presentation.kind === 'unsupported') {this.issue(presentation.kind); throw new Error('Unreadable legacy presentation');}
    return {data, view: presentation.kind === 'valid' ? presentation.view : snapshot?.view ?? initialScreenView(),
      positions: presentation.kind === 'valid' ? presentation.positions : snapshot?.positions ?? {}};
  }
  initialize = (): Promise<void> => {
    if (this.initialized) return Promise.resolve();
    return this.initializing ??= this.store.initialize(() => this.seed()).then(initial => {
      this.initialized = true; this.initializing = null;
      if (initial && !this.cacheLoaded) {
        if (!this.viewChanged) {
          // Storage treats presentation as opaque. Validate it here without
          // serializing the migrated message/card bodies a second time.
          const restored = decodeScreenSnapshot(JSON.stringify({version: 1, data: {cards: [], chats: []},
            view: initial.view, positions: initial.positions}), true);
          if (restored) {this.state = {...this.state, view: restored.view}; this.positions = restored.positions;}
        }
        // Seed only list-sized projections through normal indexed reads below.
      }
      this.cacheDirty = true; this.issue(null); this.emit();
    }).catch(error => {this.initializing = null; if (!this.state.storageIssue) this.issue('read'); throw error;});
  };
  collection(query: CollectionQuery) {
    const key = JSON.stringify(query);
    let collection = this.collections.get(key);
    if (!collection) {
      const cached = this.cachedCollections.find(item => JSON.stringify(item.query) === key)?.rows ?? [];
      collection = new WorkspaceCollection(this.store, query, this.initialize, cached);
      this.collections.set(key, collection);
      // Search-as-you-type must not retain one list for every query ever entered.
      if (this.collections.size > 12) {
        const oldest = [...this.collections].find(([id, item]) => id !== key && !item.observed)?.[0];
        if (oldest && oldest !== key) this.collections.delete(oldest);
      }
    }
    return collection;
  }
  room(id: string, fallback?: ChatRow) {
    let room = this.rooms.get(id);
    const chat = fallback ?? this.state.data.chats.find(item => item.id === id);
    if (!room && chat) {room = new WorkspaceRoom(this.store, chat); this.rooms.set(id, room);}
    return room;
  }
  private async revision(kind: 'card' | 'chat', id: string) {
    const key = `${kind}:${id}`;
    if (!this.revisions.has(key)) {
      const row = kind === 'card' ? await this.store.card(id) : await this.store.chat(id);
      this.revisions.set(key, row?.revision ?? 0);
    }
    return this.revisions.get(key)!;
  }
  prepareCard = async (id: string): Promise<void> => {
    await this.initialize();
    if (this.pending.some(write => write.key === `card:${id}`)) return;
    const card = await this.store.card(id); if (!card) return;
    if (this.pending.some(write => write.key === `card:${id}`) || (this.revisions.get(`card:${id}`) ?? 0) > card.revision) return;
    this.revisions.set(`card:${id}`, card.revision);
    this.state = {...this.state, data: {...this.state.data, cards: [card.value, ...this.state.data.cards.filter(item => item.id !== id)].slice(0, 4)}};
    this.cacheDirty = true; this.emit();
  };
  prepareChat = async (id: string): Promise<void> => {
    await this.initialize();
    const metadata = await this.store.chat(id); if (!metadata) return;
    const dirty = this.pending.some(write => write.key === `draft:${id}` || write.key.startsWith(`send:${id}:`))
      || (this.revisions.get(`chat:${id}`) ?? 0) > metadata.revision;
    if (!dirty) this.revisions.set(`chat:${id}`, metadata.revision);
    const old = this.rooms.get(id), chat = dirty && old ? old.snapshot().chat : {...metadata.value, messages: old?.snapshot().messages ?? []};
    const room = this.room(id, chat)!;
    if (!room.snapshot().ready) await room.load(this.positions[`chat:${id}`]?.anchor?.sequence);
    else if (!dirty) {
      const position = this.positions[`chat:${id}`];
      await room.refresh(metadata.value.lastSequence, !room.snapshot().hasNewer && (!position || position.maxOffset - position.offset < 80));
    }
    if (!this.pending.some(write => write.key === `draft:${id}` || write.key.startsWith(`send:${id}:`))) room.setChat(chat);
    this.state = {...this.state, data: {...this.state.data, chats: [room.snapshot().chat, ...this.state.data.chats.filter(item => item.id !== id)].slice(0, 2)}};
    for (const [key, other] of this.rooms) if (!this.state.data.chats.some(item => item.id === key) && !this.pending.some(write => write.key.includes(`:${key}`))) {
      other.dispose(); this.rooms.delete(key); this.revisions.delete(`chat:${key}`);
    }
    this.cacheDirty = true; this.emit();
  };
  updateView(update: (view: ScreenView) => ScreenView) {
    const previous = this.state.view, view = update(previous); if (view === previous) return;
    this.viewChanged = true; this.state = {...this.state, view}; this.cacheDirty = true; this.emit();
    const request = ++this.viewRequest;
    // A cache-miss route hydrates only its selected document/room.
    const load = view.chatId && view.chatId !== previous.chatId ? this.prepareChat(view.chatId)
      : (view.openedCardId ?? view.detailCardId) && (view.openedCardId !== previous.openedCardId || view.detailCardId !== previous.detailCardId)
        ? this.prepareCard((view.openedCardId ?? view.detailCardId)!) : Promise.resolve();
    void load.then(() => {if (request === this.viewRequest) this.schedule();}).catch(() => this.issue('read'));
    this.schedule();
  }
  private enqueue(key: string, run: () => Promise<void>, immediate = false) {
    // Never move a later draft ahead of a queued send, or replace a write already in flight.
    const last = this.pending.at(-1);
    const existing = !key.startsWith('send:') && !key.startsWith('create:') && last?.key === key && last !== this.activeWrite ? this.pending.length - 1 : -1;
    if (existing >= 0) this.pending[existing] = {key, run}; else this.pending.push({key, run});
    if (immediate) void this.flush(); else this.schedule();
  }
  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {this.timer = undefined; void this.flush();}, tuning.draftDelay);
  }
  dispatchCard(action: CardAction) {
    const cards = cardWorkspaceReducer(this.state.data.cards, action), card = cards.find(item => item.id === action.id);
    if (!card || card === this.state.data.cards.find(item => item.id === action.id)) return;
    this.state = {...this.state, data: {...this.state.data, cards}}; this.emit();
    this.enqueue(`card:${card.id}`, async () => {
      const version = await this.store.saveCard(card, await this.revision('card', card.id)); this.revisions.set(`card:${card.id}`, version);
      this.cacheDirty = true; this.refreshCollections('library', 'create');
    }, action.type === 'complete' || action.type === 'create');
  }
  ensureChat(card: LibraryCard) {
    if (this.rooms.has(card.id)) return;
    const at = Date.now(), chat: ChatRow = {id: card.id, title: card.title, character: card.character, tile: card.tile, lastChatAt: at,
      lastAssistantMessage: card.introduction.slice(0, 180), draft: '', draftImage: null,
      messages: [{id: `${card.id}-intro`, role: 'assistant', text: card.introduction, sentAt: at}]};
    this.room(card.id, chat);
    this.enqueue(`create:${card.id}`, async () => {
      const stored = await this.store.createChat(chat); this.revisions.set(`chat:${card.id}`, stored.revision);
      await this.prepareChat(card.id); this.refreshCollections('chats');
    }, true);
  }
  private changeDraft(id: string, patch: Partial<Pick<ChatRow, 'draft' | 'draftImage'>>) {
    const room = this.room(id); if (!room) return;
    const chat = {...room.snapshot().chat, ...patch}; room.setChat(chat);
    this.enqueue(`draft:${id}`, async () => {
      const revision = await this.store.saveDraft(id, chat.draft, chat.draftImage, await this.revision('chat', id)); this.revisions.set(`chat:${id}`, revision);
    });
  }
  updateChatDraft(id: string, draft: string) {this.changeDraft(id, {draft});}
  updateChatImage(id: string, image: GalleryImage | null) {this.changeDraft(id, {draftImage: image});}
  sendChat(id: string, image?: GalleryImage) {
    const room = this.room(id); if (!room) return;
    const chat = room.snapshot().chat, attachment = image ?? chat.draftImage;
    if (!chat.draft.trim() && !attachment) return;
    const at = Date.now(), message: ChatMessage & {role: 'user'} = {id: `${id}-${at}-${++this.counter}-${Math.random().toString(36).slice(2, 10)}`,
      role: 'user', text: chat.draft.trim(), sentAt: at, ...(attachment ? {image: attachment} : {})};
    const sequence = room.lastSequence + 1;
    room.append({...message, sequence}); room.setChat({...room.snapshot().chat, draft: '', draftImage: null, lastChatAt: at});
    this.enqueue(`send:${id}:${message.id}`, async () => {
      const stored = await this.store.send(id, message, await this.revision('chat', id)); this.revisions.set(`chat:${id}`, stored.revision);
      room.append(stored.message); this.cacheDirty = true; this.refreshCollections('chats');
    }, true);
    return message;
  }
  getScroll = (scope: ScrollScope) => this.positions[scope] ?? emptyScrollMemory;
  rememberScroll = (scope: ScrollScope, position: ScrollMemory) => {
    this.positions = {...this.positions, [scope]: {...position}}; this.cacheDirty = true;
    // Coalesce scroll persistence without serializing any message history per frame.
    if (!this.timer) this.timer = setTimeout(() => {this.timer = undefined; void this.flush();}, 700);
  };
  resetScroll(scope: ScrollScope) {this.rememberScroll(scope, emptyScrollMemory);}
  private refreshCollections(...scopes: string[]) {for (const collection of this.collections.values()) if (scopes.includes(collection.query.scope)) collection.invalidate();}
  flush = async (): Promise<void> => {
    if (this.timer) {clearTimeout(this.timer); this.timer = undefined;}
    if (this.writing) return this.writing;
    this.writing = (async () => {
      try {
        await this.initialize();
        while (this.pending.length) {
          const next = this.pending[0]!; this.activeWrite = next;
          try {await next.run();} finally {this.activeWrite = null;}
          const index = this.pending.indexOf(next); if (index >= 0) this.pending.splice(index, 1);
        }
        if (this.cacheDirty) {this.cacheDirty = false; try {await this.cache.write(this.serializeCache());} catch (error) {this.cacheDirty = true; throw error;}}
        this.issue(null);
      } catch (error) {if (this.initialized) this.issue(error instanceof ScreenStorageConflict ? 'conflict' : 'write');}
      finally {this.writing = null; if (this.pending.length && !this.state.saveError) this.schedule();}
    })();
    return this.writing;
  };
  private serializeCache() {
    const view = this.state.view;
    const cards = this.state.data.cards.filter(card => card.id === view.openedCardId || card.id === view.detailCardId);
    const chats = view.chatId ? [this.rooms.get(view.chatId)?.snapshot().chat].filter((chat): chat is ChatRow => !!chat).map(chat => {
      const saved = this.positions[`chat:${chat.id}`]?.anchor;
      const all = this.rooms.get(chat.id)!.snapshot().messages;
      const start = saved ? Math.max(0, all.findIndex(message => message.id === saved.id) - 1) : Math.max(0, all.length - 3);
      return {...chat, messages: all.slice(start, start + 3)};
    }) : [];
    const loaded = [...this.collections.values()].filter(collection => collection.snapshot().ready).slice(-tuning.cachedCollections)
      .map(collection => ({query: collection.query, rows: collection.snapshot().rows.slice(0, 18)}));
    const keys = new Set(loaded.map(collection => JSON.stringify(collection.query)));
    const collections = [...this.cachedCollections.filter(collection => !keys.has(JSON.stringify(collection.query))), ...loaded].slice(-tuning.cachedCollections);
    const snapshot: ScreenSnapshot = {version: 1, savedAt: Date.now(), data: {cards, chats}, view,
      positions: Object.fromEntries(Object.entries(this.positions).slice(-48))};
    const value: Cache = {version: 2, snapshot, collections, revisions: [...this.revisions].filter(([key]) => cards.some(card => key === `card:${card.id}`) || chats.some(chat => key === `chat:${chat.id}`))};
    let raw = JSON.stringify(value);
    // Large single documents remain in the store; a cache can always be rebuilt.
    while (raw.length > tuning.cacheCharacters && (snapshot.data.cards.length || snapshot.data.chats.length || value.collections.length)) {
      if (value.collections.length) value.collections.pop();
      else if (snapshot.data.chats.some(chat => chat.messages.length)) snapshot.data.chats.forEach(chat => {chat.messages = chat.messages.slice(1);});
      else if (snapshot.data.cards.length) snapshot.data.cards.pop();
      else snapshot.data.chats.pop(); // An oversized draft is already durable in its room row.
      raw = JSON.stringify(value);
    }
    // Even unusually large search/route text must not turn the disposable cache
    // back into an unbounded startup document. The database is unaffected.
    return raw.length <= tuning.cacheCharacters ? raw : JSON.stringify({version: 2, collections: [], revisions: [],
      snapshot: {...snapshot, data: {cards: [], chats: []}, positions: {}, view: {...initialScreenView(), themeMode: view.themeMode, tab: view.tab}}});
  }
  refresh = async (_load?: () => Promise<ScreenData | null>): Promise<void> => {
    try {
      await this.initialize();
      if (!this.pending.length) {
        const view = this.state.view;
        if (view.openedCardId ?? view.detailCardId) await this.prepareCard((view.openedCardId ?? view.detailCardId)!);
        if (view.chatId) await this.prepareChat(view.chatId);
        for (const collection of this.collections.values()) {
          // An initial read already shares initialize(). Invalidating it here
          // would discard that fresh result and immediately read the page twice.
          if (collection.snapshot().ready) collection.invalidate();
        }
      }
      this.issue(null);
    } catch {if (!this.state.storageIssue) this.issue('read');}
  };
}
