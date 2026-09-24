import type {FolderRemoval} from '../library/FolderLibrary';
import type {CreationStore} from './store';
import {AiUnavailableError} from '../../ports/ai';
import {cardContext, newId, type Card, type Draft} from '../cards/model';
import type {Message} from './model';
import {buildContext} from './context';
import type {GenerationCoordinator} from './generation';

export interface LiveGeneration { requestId: string; conversationId: string; message: Message; omitted: number }
export class CreationService {
  private readonly listeners = new Set<() => void>();
  private readonly active = new Map<string, LiveGeneration>();
  private readonly sends = new Map<string, Set<Promise<void>>>();
  private readonly deleting = new Set<string>();
  private readonly deletingCards = new Set<string>();
  private readonly draftJobs = new Map<string, {id: string; task: Promise<Draft>}>();
  private revision = 0;
  private readonly cancelled = new Set<string>();
  private readonly drafts = new Map<string, Draft>();
  private error: string | null = null;
  constructor(private readonly repo: CreationStore, readonly coordinator: GenerationCoordinator) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.revision;
  private emit() { this.revision++; this.listeners.forEach(fn => fn()); }
  live(conversationId: string) { return this.active.get(conversationId); }
  draft(cardId: string) { return this.drafts.get(cardId); }
  markDraftApplied(cardId: string, draftId: string) {const draft = this.drafts.get(cardId); if (draft?.id === draftId) {this.drafts.set(cardId, {...draft, status: 'applied'}); this.emit();}}
  lastError() { return this.error; }
  cancel(requestId: string) { this.cancelled.add(requestId); this.coordinator.cancel(requestId); }
  send(card: Card, conversationId: string, input: string, requestId = newId('request'), onAccepted?: () => void, draftRevision?: number) {
    if (this.deleting.has(conversationId) || this.deletingCards.has(card.id)) return Promise.reject(new Error('삭제 중인 채팅입니다.'));
    const tasks = this.sends.get(conversationId) ?? new Set<Promise<void>>();
    this.sends.set(conversationId, tasks);
    const task = this.sendMessage(card, conversationId, input, requestId, onAccepted, draftRevision).finally(() => {
      tasks.delete(task);
      if (!tasks.size) this.sends.delete(conversationId);
    });
    tasks.add(task);
    return task;
  }
  async deleteConversations(ids: readonly string[], folders?: FolderRemoval) {
    const unique = [...new Set(ids)];
    unique.forEach(id => this.deleting.add(id));
    try {
      for (const id of unique) {
        const live = this.active.get(id);
        if (live) this.cancel(live.requestId);
      }
      // Let cancellation finish its last write before cascading the messages away.
      await Promise.allSettled(unique.flatMap(id => [...this.sends.get(id) ?? []]));
      await this.repo.deleteConversations(unique, folders);
      unique.forEach(id => this.active.delete(id));
    } finally {unique.forEach(id => this.deleting.delete(id)); this.emit();}
  }
  /** Card removal waits for every last message/draft write before the FK cascade. */
  async deleteCards(ids: readonly string[], folders?: FolderRemoval) {
    const cards = [...new Set(ids)];
    cards.forEach(id => this.deletingCards.add(id));
    let rooms: string[] = [];
    try {
      rooms = (await this.repo.conversations()).filter(room => cards.includes(room.cardId)).map(room => room.id);
      rooms.forEach(id => this.deleting.add(id));
      for (const id of rooms) {
        const live = this.active.get(id);
        if (live) this.cancel(live.requestId);
      }
      const drafts = cards.flatMap(id => {
        const job = this.draftJobs.get(id);
        if (!job) return [];
        this.cancel(job.id);
        return [job.task];
      });
      await Promise.allSettled([...drafts, ...rooms.flatMap(id => [...this.sends.get(id) ?? []])]);
      await this.repo.deleteCards(cards, folders);
      cards.forEach(id => this.drafts.delete(id));
      rooms.forEach(id => this.active.delete(id));
      return rooms;
    } finally {
      cards.forEach(id => this.deletingCards.delete(id));
      rooms.forEach(id => this.deleting.delete(id));
      this.emit();
    }
  }
  private async sendMessage(card: Card, conversationId: string, input: string, requestId: string, onAccepted?: () => void, draftRevision?: number) {
    if (!input.trim()) return;
    if (!this.coordinator.provider.connected) {
      if (draftRevision === undefined) throw new AiUnavailableError();
      await this.repo.acceptChatSubmission({id: requestId, conversationId, text: input, draftRevision, generate: false});
      onAccepted?.();
      return;
    }
    // Context reads are independent from the screen's 40-row page.
    const history = await this.repo.messages(conversationId, Number.MAX_SAFE_INTEGER, 200);
    if (this.deleting.has(conversationId) || this.deletingCards.has(card.id)) return;
    const context = buildContext(card, history, input, this.coordinator.provider.inputCharacterLimit);
    const receipt = draftRevision === undefined ? {...await this.repo.beginExchange(conversationId, requestId, input.trim()), replayed: false} : await this.repo.acceptChatSubmission({id: requestId, conversationId, text: input, draftRevision, generate: true});
    onAccepted?.();
    const assistant = receipt.assistant;
    if (receipt.replayed || !assistant) return;
    if (this.deleting.has(conversationId) || this.deletingCards.has(card.id) || this.cancelled.has(requestId)) {
      await this.repo.saveMessage({...assistant, status: 'cancelled'});
      this.cancelled.delete(requestId);
      return;
    }
    let message: Message = {...assistant, status: 'generating'};
    let lastSave = 0; let lastRender = 0;
    const publish = () => { this.active.set(conversationId, {requestId, conversationId, message: {...message}, omitted: context.omitted}); this.emit(); };
    publish();
    try {
      await this.coordinator.run({id: requestId, purpose: 'chat', instruction: input, context: context.context, messages: context.messages}, async event => {
        if (event.type === 'delta') message = {...message, content: message.content + event.text};
        const now = Date.now();
        if (now - lastRender >= 50) { publish(); lastRender = now; }
        if (now - lastSave >= 700) { await this.repo.saveMessage(message); lastSave = now; }
      });
      message = {...message, status: 'completed'};
    } catch (error) {
      message = {...message, status: this.cancelled.has(requestId) ? 'cancelled' : 'failed', error: error instanceof Error ? error.message : '응답 처리에 실패했습니다.'};
    }
    try { await this.repo.saveMessage(message); this.error = null; }
    catch (error) { this.error = error instanceof Error ? error.message : '응답 저장 실패'; message = {...message, status: 'failed', error: this.error}; publish(); throw error; }
    finally { this.cancelled.delete(requestId); if (!this.error) this.active.delete(conversationId); this.emit(); }
  }
  async generateDraft(card: Card, instruction: string, kind: Draft['kind']) {
    if (!instruction.trim()) throw new Error('AI에게 요청할 내용을 적어 주세요.');
    if (!this.coordinator.provider.connected) throw new AiUnavailableError();
    if (this.deletingCards.has(card.id)) throw new Error('삭제 중인 카드입니다.');
    if (this.draftJobs.has(card.id)) throw new Error('이 카드의 초안을 이미 생성 중입니다.');
    const id = newId('draft');
    const task = this.createDraft(card, instruction, kind, id).finally(() => {
      this.draftJobs.delete(card.id);
      this.cancelled.delete(id);
    });
    this.draftJobs.set(card.id, {id, task});
    return task;
  }
  private async createDraft(card: Card, instruction: string, kind: Draft['kind'], id: string) {
    let draft: Draft = {id, cardId: card.id, baseRevision: card.revision, kind, status: 'generating', instruction, content: '', sources: [], error: null, createdAt: Date.now()};
    await this.repo.putDraft(draft); this.drafts.set(card.id, draft); this.emit();
    let lastSave = 0; let lastRender = 0;
    try {
      if (this.deletingCards.has(card.id) || this.cancelled.has(id)) throw new Error('초안 생성을 취소했습니다.');
      await this.coordinator.run({id: draft.id, purpose: kind, instruction, context: cardContext(card), messages: []}, async event => {
        if (event.type === 'delta') draft = {...draft, content: draft.content + event.text};
        if (event.type === 'source') draft = {...draft, sources: [...draft.sources, event.source]};
        const now = Date.now();
        if (now - lastRender > 50) { this.drafts.set(card.id, draft); this.emit(); lastRender = now; }
        if (now - lastSave > 700) { await this.repo.putDraft(draft); lastSave = now; }
      });
      draft = {...draft, status: 'completed'};
    } catch (error) { draft = {...draft, status: this.cancelled.has(draft.id) ? 'cancelled' : 'failed', error: error instanceof Error ? error.message : '초안 생성에 실패했습니다.'}; }
    try { await this.repo.putDraft(draft); }
    catch (error) { draft = {...draft, status: 'failed', error: '초안을 기기에 저장하지 못했습니다.'}; throw error; }
    finally { this.cancelled.delete(draft.id); this.drafts.set(card.id, draft); this.emit(); }
    return draft;
  }
}
