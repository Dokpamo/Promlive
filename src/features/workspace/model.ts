/** Persisted card and local conversation data, independent of screen components. */
export type GalleryImage = {id: string; tile: number; title: string};

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

export type ChatMessage = {id: string; role: 'user' | 'assistant'; text: string; sentAt: number; image?: GalleryImage};
export type Conversation = {messages: ChatMessage[]; draft: string; draftImage: GalleryImage | null};

export type ChatRow = {id: string; title: string; character: string; tile: number; lastChatAt: number; lastAssistantMessage: string} & Conversation;
export type WorkspaceData = {cards: WorkCard[]; chats: ChatRow[]};
