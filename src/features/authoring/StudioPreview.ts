import {newId, type Card, type Draft} from '../cards/model';
import type {Message} from '../chat/model';
import type {AcceptedSubmission, ChatSubmission, ComposerDraft} from '../chat/sessionStore';
import type {CreationStore} from '../chat/store';
import {CreationService} from '../chat/service';
import {ChatSession} from '../chat/ChatSession';
import type {GenerationCoordinator} from '../chat/generation';
import {initialScene, normalizeScene, type SceneState} from '../cards/experience';

/** A preview uses the production chat flow with an isolated, disposable store. */
class PreviewStore implements CreationStore {
  private items: Message[] = [];
  private draft: ComposerDraft = {text: '', revision: 0, acceptedRevision: -1};
  private submissions = new Map<string, Awaited<ReturnType<PreviewStore['acceptChatSubmission']>>>();
  private scene: SceneState | null;
  constructor(readonly roomId: string, readonly card: Card, startId?: string) {
    this.scene = card.experience ? initialScene(card.experience, startId) : null;
    const greeting = card.experience ? card.experience.starts.find(s => s.id === this.scene?.startId)?.greeting : card.body.kind === 'template' ? card.body.data.greeting : '';
    if (greeting?.trim()) this.items.push(this.make('assistant', greeting, null));
  }
  private make(role: Message['role'], content: string, requestId: string | null): Message {
    return {id: newId('preview_message'), conversationId: this.roomId, sequence: this.items.length + 1, role, content, status: 'completed', requestId, error: null, createdAt: Date.now()};
  }
  async messages(_id: string, before = Number.MAX_SAFE_INTEGER, limit = 40) {return this.items.filter(m => m.sequence < before).slice(-limit).map(m => ({...m}));}
  async getConversationCard() {return this.card;}
  async getSceneState() {return this.scene;}
  async setSceneState(_id: string, state: SceneState) {if (this.card.experience) this.scene = normalizeScene(this.card.experience, state);}
  async loadComposerDraft() {return {...this.draft};}
  async writeComposerDraft(_id: string, next: Pick<ComposerDraft, 'text' | 'revision'>) {if (next.revision > this.draft.acceptedRevision && next.revision >= this.draft.revision) this.draft = {...this.draft, ...next};}
  async beginExchange(_id: string, requestId: string, content: string) {
    const user = this.make('user', content, requestId); this.items.push(user);
    const assistant = {...this.make('assistant', '', requestId), status: 'pending' as const}; this.items.push(assistant);
    return {user, assistant};
  }
  async acceptChatSubmission(input: ChatSubmission): Promise<AcceptedSubmission> {
    const existing = this.submissions.get(input.id);
    if (existing) return {...existing, replayed: true};
    const pair = input.generate ? await this.beginExchange(this.roomId, input.id, input.text) : {user: this.make('user', input.text, input.id), assistant: undefined};
    if (!input.generate) this.items.push(pair.user);
    this.draft = {...this.draft, text: this.draft.revision === input.draftRevision ? '' : this.draft.text, acceptedRevision: input.draftRevision};
    const result = {...pair, replayed: false}; this.submissions.set(input.id, result); return result;
  }
  async saveMessage(message: Message) {this.items = this.items.map(item => item.id === message.id ? {...message} : item);}
  async putDraft(_draft: Draft) {throw new Error('미리보기에서는 제작 초안을 저장하지 않아요.');}
  async conversations() {return [];}
  async deleteConversations() {this.items = [];}
  async deleteCards() {throw new Error('미리보기에서는 카드를 삭제할 수 없어요.');}
}

export class StudioPreview {
  readonly store: PreviewStore;
  readonly creation: CreationService;
  readonly session: ChatSession;
  constructor(readonly card: Card, readonly revision: number, coordinator: GenerationCoordinator, notify: (error?: unknown) => void, startId?: string) {
    const roomId = newId('preview');
    this.store = new PreviewStore(roomId, card, startId);
    this.creation = new CreationService(this.store, coordinator);
    this.session = new ChatSession(roomId, card, this.store, this.creation, notify);
  }
  dispose() {
    const send = this.session.snapshot().send;
    if ('requestId' in send) this.creation.cancel(send.requestId);
    this.session.dispose();
  }
}
