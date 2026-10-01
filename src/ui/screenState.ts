import {createPreviewWorkspace, type CardContent, type WorkCard} from './cardWorkspace';
import {chatPreviewRows} from './chatPreview';
import type {CreationFilter} from './creationPreview';
import type {Tab} from './Navigation';
import {defaultCardDetails, nightLibraryDetails, type GalleryImage} from './cardDetails';
import {creationPreviewItems} from './creationPreview';
import {previewConversation, type Conversation, type ChatMessage} from './chatConversation';

export type ChatRow = {id: string; title: string; character: string; tile: number; lastChatAt: number; lastAssistantMessage: string} & Conversation;
export type ScreenData = {cards: WorkCard[]; chats: ChatRow[]};
export type SearchState = {open: boolean; query: string};
export type LibraryFilter = 'all' | 'recent' | 'idle';
export type ScreenView = {
  themeMode: 'light' | 'dark' | 'system';
  tab: Tab;
  searches: Record<'library' | 'chats' | 'create', SearchState>;
  libraryFilter: LibraryFilter;
  creationFilter: CreationFilter;
  openedCardId: string | null;
  detailCardId: string | null;
  coverOpen: boolean;
  galleryIndex: number | null;
  chatId: string | null;
};
export type ScrollMemory = {offset: number; hidden: number; height: number; maxOffset: number};
export type ScrollScope = Tab | 'editor' | 'detail' | `chat:${string}` | `library:${LibraryFilter}` | `create:${CreationFilter}`;
export type ScreenSnapshot = {version: 1; savedAt: number; data: ScreenData; view: ScreenView; positions: Partial<Record<ScrollScope, ScrollMemory>>};
export type ScreenState = {data: ScreenData; view: ScreenView; saveError: boolean};

export function initialScreenData(): ScreenData { return {cards: createPreviewWorkspace(), chats: chatPreviewRows}; }
export function initialScreenView(): ScreenView {
  return {themeMode: 'light', tab: 'library', searches: {library: {open: false, query: ''}, chats: {open: false, query: ''}, create: {open: false, query: ''}},
    libraryFilter: 'all', creationFilter: 'all', openedCardId: null, detailCardId: null, coverOpen: false, galleryIndex: null, chatId: null};
}
export const emptyScrollMemory: ScrollMemory = {offset: 0, hidden: 0, height: 0, maxOffset: 0};

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const tile = (value: unknown): value is number => number(value) && Number.isInteger(value) && value < 14;
const choice = <T extends string>(value: unknown, choices: readonly T[]): value is T => choices.includes(value as T);
const content = (value: unknown): value is CardContent => object(value) && tile(value.tile)
  && ['title', 'character', 'creator', 'summary', 'introduction', 'guide'].every(key => text(value[key]))
  && Array.isArray(value.tags) && value.tags.every(text) && Array.isArray(value.gallery) && value.gallery.every(galleryImage) && unique(value.gallery);
const galleryImage = (value: unknown): value is GalleryImage => object(value) && text(value.id) && value.id.length > 0 && text(value.title) && tile(value.tile);
const message = (value: unknown): value is ChatMessage => object(value) && text(value.id) && value.id.length > 0
  && choice(value.role, ['user', 'assistant']) && text(value.text) && number(value.sentAt) && (value.image === undefined || galleryImage(value.image));
const card = (value: unknown): value is WorkCard => object(value) && text(value.id) && value.id.length > 0
  && choice(value.origin, ['created', 'external']) && content(value.draft) && (value.published === null || content(value.published))
  && typeof value.working === 'boolean' && number(value.updatedAt) && choice(value.activity, ['recent', 'idle']);
const chat = (value: unknown): value is ChatRow => object(value) && text(value.id) && value.id.length > 0
  && text(value.title) && text(value.character) && text(value.lastAssistantMessage) && tile(value.tile) && number(value.lastChatAt)
  && text(value.draft) && (value.draftImage === null || galleryImage(value.draftImage)) && Array.isArray(value.messages) && value.messages.every(message) && unique(value.messages);
const unique = (rows: {id: string}[]) => new Set(rows.map(row => row.id)).size === rows.length;

export function validScreenData(value: unknown): value is ScreenData {
  return object(value) && Array.isArray(value.cards) && value.cards.every(card) && unique(value.cards)
    && Array.isArray(value.chats) && value.chats.every(chat) && unique(value.chats);
}

/** Add new sample sections once without resetting saved cards, edits or conversation drafts. */
function upgradeData(value: unknown): ScreenData | null {
  if (!object(value) || !Array.isArray(value.cards) || !Array.isArray(value.chats)) return null;
  const readContent = (raw: unknown, id: string) => {
    if (!object(raw) || !tile(raw.tile)) return raw;
    const defaults = defaultCardDetails(id, raw.tile);
    const oldSample = creationPreviewItems.find(item => item.card.id === id);
    const enriching = id === 'night-library' && raw.gallery === undefined;
    return {...raw, tags: raw.tags ?? defaults.tags, gallery: raw.gallery ?? defaults.gallery, guide: raw.guide ?? defaults.guide,
      summary: enriching && raw.summary === oldSample?.summary ? nightLibraryDetails.summary : raw.summary,
      introduction: enriching && raw.introduction === oldSample?.introduction ? nightLibraryDetails.introduction : raw.introduction};
  };
  const data = {
    cards: value.cards.map(raw => object(raw) && text(raw.id) ? {...raw, draft: readContent(raw.draft, raw.id), published: raw.published === null ? null : readContent(raw.published, raw.id)} : raw),
    chats: value.chats.map(raw => object(raw) && text(raw.id) && text(raw.lastAssistantMessage) && number(raw.lastChatAt)
      ? {...raw, ...(raw.messages === undefined ? previewConversation(raw.id, raw.lastAssistantMessage, raw.lastChatAt) : {}), draft: raw.draft ?? '', draftImage: raw.draftImage ?? null} : raw),
  };
  return validScreenData(data) ? data : null;
}

/** Validate persisted content separately from optional/older presentation fields. */
export function decodeScreenSnapshot(raw: string | null): ScreenSnapshot | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!object(value) || value.version !== 1) return null;
    const data = upgradeData(value.data);
    if (!data) return null;
    const view = initialScreenView();
    const saved = object(value.view) ? value.view : {};
    if (choice(saved.themeMode, ['light', 'dark', 'system'])) view.themeMode = saved.themeMode;
    if (choice(saved.tab, ['library', 'chats', 'create', 'settings'])) view.tab = saved.tab;
    if (choice(saved.libraryFilter, ['all', 'recent', 'idle'])) view.libraryFilter = saved.libraryFilter;
    if (choice(saved.creationFilter, ['all', 'draft', 'ready', 'mine', 'external'])) view.creationFilter = saved.creationFilter;
    if (typeof saved.openedCardId === 'string' && data.cards.some(card => card.id === saved.openedCardId)) view.openedCardId = saved.openedCardId;
    if (typeof saved.detailCardId === 'string' && data.cards.some(card => card.id === saved.detailCardId && card.published)) view.detailCardId = saved.detailCardId;
    if (!view.openedCardId && typeof saved.chatId === 'string' && data.chats.some(chat => chat.id === saved.chatId)) view.chatId = saved.chatId;
    view.coverOpen = saved.coverOpen === true && !!view.detailCardId && !view.openedCardId && !view.chatId;
    const gallery = data.cards.find(card => card.id === view.detailCardId)?.published?.gallery;
    if (view.coverOpen && number(saved.galleryIndex) && Number.isInteger(saved.galleryIndex) && gallery?.[saved.galleryIndex]) view.galleryIndex = saved.galleryIndex;
    if (object(saved.searches)) for (const scope of ['library', 'chats', 'create'] as const) {
      const search = saved.searches[scope];
      if (object(search) && typeof search.open === 'boolean' && text(search.query)) view.searches[scope] = {open: search.open, query: search.query};
    }
    const positions: ScreenSnapshot['positions'] = {};
    const scopes: ScrollScope[] = ['library', 'chats', 'create', 'settings', 'editor', 'detail',
      'library:all', 'library:recent', 'library:idle', 'create:all', 'create:draft', 'create:ready', 'create:mine', 'create:external', ...data.chats.map(chat => `chat:${chat.id}` as const)];
    if (object(value.positions)) for (const scope of scopes) {
      const position = value.positions[scope];
      if (object(position) && number(position.offset) && number(position.hidden) && number(position.height) && number(position.maxOffset)) {
        positions[scope] = {offset: Math.min(position.offset, position.maxOffset), hidden: Math.min(position.hidden, position.height), height: position.height, maxOffset: position.maxOffset};
      }
    }
    // Older snapshots saved one position per tab. Assign it only to that tab's selected filter.
    const libraryScope = `library:${view.libraryFilter}` as const;
    const creationScope = `create:${view.creationFilter}` as const;
    if (!positions[libraryScope] && positions.library) positions[libraryScope] = positions.library;
    if (!positions[creationScope] && positions.create) positions[creationScope] = positions.create;
    return {version: 1, savedAt: number(value.savedAt) ? value.savedAt : 0, data, view, positions};
  } catch { return null; }
}

/** Stable identities keep unchanged rows/images mounted during background refresh. */
function shareRows<T extends {id: string}>(previous: T[], next: T[]): T[] {
  const byId = new Map(previous.map(row => [row.id, row]));
  const rows = next.map(row => {
    const old = byId.get(row.id);
    return old && JSON.stringify(old) === JSON.stringify(row) ? old : row;
  });
  return rows.length === previous.length && rows.every((row, index) => row === previous[index]) ? previous : rows;
}
export function reconcileScreenData(previous: ScreenData, next: ScreenData): ScreenData {
  const cards = shareRows(previous.cards, next.cards);
  const chats = shareRows(previous.chats, next.chats);
  return cards === previous.cards && chats === previous.chats ? previous : {cards, chats};
}
