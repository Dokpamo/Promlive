import {creationPreviewItems, type CreationFilter} from './creationPreview';
import {defaultCardDetails, nightLibraryDetails, type GalleryImage} from './cardDetails';

export type CardContent = {
  title: string;
  character: string;
  creator: string;
  tile: number;
  summary: string;
  introduction: string;
  tags: string[];
  gallery: GalleryImage[];
  guide: string;
};
export type EditableCardField = 'title' | 'character' | 'creator' | 'summary' | 'introduction' | 'guide' | 'tags';
export type WorkCard = {
  id: string;
  origin: 'created' | 'external';
  draft: CardContent;
  published: CardContent | null;
  working: boolean;
  updatedAt: number;
  activity: 'recent' | 'idle';
};
export type LibraryCard = CardContent & {id: string; activity: 'recent' | 'idle'};
export type CardAction =
  | {type: 'create'; id: string; now: number}
  | {type: 'edit'; id: string; field: EditableCardField; value: string; now: number}
  | {type: 'gallery'; id: string; images: GalleryImage[]; now: number}
  | {type: 'complete'; id: string; now: number};

/** UI workspace model persisted by ScreenMemory. A draft never modifies the published library snapshot. */
export function createPreviewWorkspace(): WorkCard[] {
  const external: WorkCard[] = creationPreviewItems.map(item => {
    const {card} = item;
    const content: CardContent = {title: card.title, character: card.character, creator: card.creator,
      tile: card.tile, summary: item.summary, introduction: item.introduction,
      ...defaultCardDetails(card.id, card.tile), ...(card.id === 'night-library' ? nightLibraryDetails : {})};
    return {id: card.id, origin: 'external', draft: {...content}, published: {...content}, working: false,
      updatedAt: item.modifiedAt, activity: card.activity};
  });
  const now = Date.now();
  const drafts: WorkCard[] = [
    {tile: 1, title: '새벽 우체국의 배달부'}, {tile: 8, title: '달빛 열차의 마지막 승객'}, {tile: 9, title: '어느 여름의 기록'},
  ].map(({tile, title}, index) => {
    const source = external.find(card => card.draft.tile === tile);
    if (!source) throw new Error(`Missing preview artwork: ${tile}`);
    return {id: `draft-${index + 1}`, origin: 'created', draft: {...source.draft, title, creator: '나'},
      published: null, working: true, updatedAt: now - (index + 1) * 60_000, activity: 'recent'};
  });
  return [...drafts, ...external];
}

export function cardWorkspaceReducer(cards: WorkCard[], action: CardAction): WorkCard[] {
  if (action.type === 'create') {
    if (cards.some(card => card.id === action.id)) return cards;
    return [{id: action.id, origin: 'created', draft: {title: '', character: '', creator: '나', tile: 0,
      summary: '', introduction: '', tags: [], gallery: [], guide: ''}, published: null, working: true, updatedAt: action.now, activity: 'recent'}, ...cards];
  }
  return cards.map(card => {
    if (card.id !== action.id) return card;
    if (action.type === 'gallery') return {...card, draft: {...card.draft, gallery: action.images.map(image => ({...image}))}, working: true, updatedAt: action.now};
    if (action.type === 'edit') {
      if (action.field === 'tags') return {...card, draft: {...card.draft, tags: action.value.split(',').map(tag => tag.trim()).filter(Boolean)}, working: true, updatedAt: action.now};
      if (card.draft[action.field] === action.value) return card;
      return {...card, draft: {...card.draft, [action.field]: action.value}, working: true, updatedAt: action.now};
    }
    // Drafts may be incomplete. Every public section except the guide is required.
    if (missingCardFields(card.draft).length) return card;
    const content = {...card.draft, title: card.draft.title.trim()};
    return {...card, draft: {...content}, published: {...content}, working: false, updatedAt: action.now};
  });
}

export function missingCardFields(content: CardContent) {
  const missing = (['title', 'creator', 'summary', 'introduction'] as const).filter(field => !content[field].trim()) as string[];
  if (!content.tags.some(tag => tag.trim())) missing.push('tags');
  if (!content.gallery.length) missing.push('gallery');
  return missing;
}

export function publishedLibraryCards(cards: WorkCard[]): LibraryCard[] {
  return cards.flatMap(card => card.published ? [{...card.published, id: card.id, activity: card.activity}] : []);
}

export function filteredWorkCards(cards: WorkCard[], filter: CreationFilter, query: string): WorkCard[] {
  const term = query.trim().normalize('NFKC').toLocaleLowerCase();
  return cards.filter(card => {
    if (filter === 'draft' && !card.working) return false;
    if (filter === 'ready' && card.working) return false;
    if (filter === 'mine' && card.origin !== 'created') return false;
    if (filter === 'external' && card.origin !== 'external') return false;
    const {title, character, creator, summary} = card.draft;
    return `${title} ${character} ${creator} ${summary}`.normalize('NFKC').toLocaleLowerCase().includes(term);
  }).sort((a, b) => b.updatedAt - a.updatedAt);
}
