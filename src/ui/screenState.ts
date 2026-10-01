import {createPreviewWorkspace, type CardContent, type WorkCard} from './cardWorkspace';
import {chatPreviewRows} from './chatPreview';
import type {CreationFilter} from './creationPreview';
import type {Tab} from './Navigation';

export type ChatRow = {id: string; title: string; character: string; tile: number; lastChatAt: number; lastAssistantMessage: string};
export type ScreenData = {cards: WorkCard[]; chats: ChatRow[]};
export type SearchState = {open: boolean; query: string};
export type LibraryFilter = 'all' | 'recent' | 'idle';
export type ScreenView = {
  tab: Tab;
  searches: Record<'library' | 'chats' | 'create', SearchState>;
  libraryFilter: LibraryFilter;
  creationFilter: CreationFilter;
  openedCardId: string | null;
  detailCardId: string | null;
  coverOpen: boolean;
};
export type ScrollMemory = {offset: number; hidden: number; height: number; maxOffset: number};
export type ScrollScope = Tab | 'editor' | 'detail' | `library:${LibraryFilter}` | `create:${CreationFilter}`;
export type ScreenSnapshot = {version: 1; savedAt: number; data: ScreenData; view: ScreenView; positions: Partial<Record<ScrollScope, ScrollMemory>>};
export type ScreenState = {data: ScreenData; view: ScreenView; saveError: boolean};

export function initialScreenData(): ScreenData { return {cards: createPreviewWorkspace(), chats: chatPreviewRows}; }
export function initialScreenView(): ScreenView {
  return {tab: 'library', searches: {library: {open: false, query: ''}, chats: {open: false, query: ''}, create: {open: false, query: ''}},
    libraryFilter: 'all', creationFilter: 'all', openedCardId: null, detailCardId: null, coverOpen: false};
}
export const emptyScrollMemory: ScrollMemory = {offset: 0, hidden: 0, height: 0, maxOffset: 0};

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const tile = (value: unknown) => number(value) && Number.isInteger(value) && value < 12;
const choice = <T extends string>(value: unknown, choices: readonly T[]): value is T => choices.includes(value as T);
const content = (value: unknown): value is CardContent => object(value) && tile(value.tile)
  && ['title', 'character', 'creator', 'summary', 'introduction'].every(key => text(value[key]));
const card = (value: unknown): value is WorkCard => object(value) && text(value.id) && value.id.length > 0
  && choice(value.origin, ['created', 'external']) && content(value.draft) && (value.published === null || content(value.published))
  && typeof value.working === 'boolean' && number(value.updatedAt) && choice(value.activity, ['recent', 'idle']);
const chat = (value: unknown): value is ChatRow => object(value) && text(value.id) && value.id.length > 0
  && text(value.title) && text(value.character) && text(value.lastAssistantMessage) && tile(value.tile) && number(value.lastChatAt);
const unique = (rows: {id: string}[]) => new Set(rows.map(row => row.id)).size === rows.length;

export function validScreenData(value: unknown): value is ScreenData {
  return object(value) && Array.isArray(value.cards) && value.cards.every(card) && unique(value.cards)
    && Array.isArray(value.chats) && value.chats.every(chat) && unique(value.chats);
}

/** Validate persisted content separately from optional/older presentation fields. */
export function decodeScreenSnapshot(raw: string | null): ScreenSnapshot | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!object(value) || value.version !== 1 || !validScreenData(value.data)) return null;
    const view = initialScreenView();
    const saved = object(value.view) ? value.view : {};
    if (choice(saved.tab, ['library', 'chats', 'create', 'settings'])) view.tab = saved.tab;
    if (choice(saved.libraryFilter, ['all', 'recent', 'idle'])) view.libraryFilter = saved.libraryFilter;
    if (choice(saved.creationFilter, ['all', 'draft', 'ready', 'mine', 'external'])) view.creationFilter = saved.creationFilter;
    if (typeof saved.openedCardId === 'string' && value.data.cards.some(card => card.id === saved.openedCardId)) view.openedCardId = saved.openedCardId;
    if (typeof saved.detailCardId === 'string' && value.data.cards.some(card => card.id === saved.detailCardId && card.published)) view.detailCardId = saved.detailCardId;
    view.coverOpen = saved.coverOpen === true && !!view.detailCardId && !view.openedCardId;
    if (object(saved.searches)) for (const scope of ['library', 'chats', 'create'] as const) {
      const search = saved.searches[scope];
      if (object(search) && typeof search.open === 'boolean' && text(search.query)) view.searches[scope] = {open: search.open, query: search.query};
    }
    const positions: ScreenSnapshot['positions'] = {};
    if (object(value.positions)) for (const scope of ['library', 'chats', 'create', 'settings', 'editor', 'detail',
      'library:all', 'library:recent', 'library:idle', 'create:all', 'create:draft', 'create:ready', 'create:mine', 'create:external'] as const) {
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
    return {version: 1, savedAt: number(value.savedAt) ? value.savedAt : 0, data: value.data, view, positions};
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
