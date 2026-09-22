import type {StoryRepository} from '../../ports/repository';
import {AiUnavailableError} from '../../ports/ai';
import {cardContext, newId, type Card, type Draft} from '../cards/model';
import type {Message} from './model';
import {buildContext} from './context';
import type {GenerationCoordinator} from './generation';

export interface LiveGeneration { requestId: string; conversationId: string; message: Message; omitted: number }
export class CreationService {
  private readonly listeners = new Set<() => void>();
  private readonly active = new Map<string, LiveGeneration>();
  private revision = 0;
  private readonly cancelled = new Set<string>();
  private readonly drafts = new Map<string, Draft>();
  private error: string | null = null;
  constructor(private readonly repo: StoryRepository, readonly coordinator: GenerationCoordinator) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.revision;
  private emit() { this.revision++; this.listeners.forEach(fn => fn()); }
  live(conversationId: string) { return this.active.get(conversationId); }
  draft(cardId: string) { return this.drafts.get(cardId); }
  markDraftApplied(cardId: string, draftId: string) {const draft = this.drafts.get(cardId); if (draft?.id === draftId) {this.drafts.set(cardId, {...draft, status: 'applied'}); this.emit();}}
  lastError() { return this.error; }
  cancel(requestId: string) { this.cancelled.add(requestId); this.coordinator.cancel(requestId); }
  async send(card: Card, conversationId: string, input: string, requestId = newId('request'), onAccepted?: () => void) {
    if (!input.trim()) return;
    if (!this.coordinator.provider.connected) throw new AiUnavailableError();
    // Context reads are independent from the screen's 40-row page.
    const history = await this.repo.messages(conversationId, Number.MAX_SAFE_INTEGER, 200);
    const context = buildContext(card, history, input, this.coordinator.provider.inputCharacterLimit);
    const {assistant} = await this.repo.beginExchange(conversationId, requestId, input.trim());
    onAccepted?.();
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
    if (this.drafts.get(card.id)?.status === 'generating') throw new Error('이 카드의 초안을 이미 생성 중입니다.');
    let draft: Draft = {id: newId('draft'), cardId: card.id, baseRevision: card.revision, kind, status: 'generating', instruction, content: '', sources: [], error: null, createdAt: Date.now()};
    await this.repo.putDraft(draft); this.drafts.set(card.id, draft); this.emit();
    let lastSave = 0; let lastRender = 0;
    try {
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
