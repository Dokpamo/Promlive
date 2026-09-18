import type {Runtime} from './runtime';
import {newCard, type Card, type Draft, type World} from '../features/cards/model';
import type {Conversation} from '../features/chat/model';
export type Page = 'library' | 'editor' | 'chat' | 'settings';
export type LibraryFilter = 'all' | 'favorites' | 'archived';
export interface Editor {card: Card; baseRevision: number; dirty: boolean; status: 'saved' | 'saving' | 'buffered' | 'error'}
export interface AssistantForm {prompt: string; mode: Draft['kind']; target: keyof World; content: string; sourceContent: string; draftId: string}
export class Workspace {
  private listeners = new Set<() => void>(); private version = 0;
  page: Page = 'library'; filter: LibraryFilter = 'all'; search = '';
  cards: Card[] = []; conversations: Conversation[] = []; editor: Editor | null = null;
  conversation: Conversation | null = null; error: string | null = null; notice: string | null = null;
  private bufferTimer: ReturnType<typeof setTimeout> | undefined;
  private saving: Promise<void> | undefined;
  private assistantForms = new Map<string, AssistantForm>();
  constructor(readonly runtime: Runtime) {}
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  snapshot = () => this.version;
  emit() { this.version++; this.listeners.forEach(fn => fn()); }
  assistantForm(id: string) {let form = this.assistantForms.get(id); if (!form) {form = {prompt: '', mode: 'writing', target: 'world', content: '', sourceContent: '', draftId: ''}; this.assistantForms.set(id, form);} return form;}
  editAssistant(id: string, patch: Partial<AssistantForm>) {this.assistantForms.set(id, {...this.assistantForm(id), ...patch}); this.emit();}
  async ready() { await this.refresh(); }
  async refresh() { this.cards = await this.runtime.repo.listCards(); this.conversations = await this.runtime.repo.conversations(); this.emit(); }
  report(error: unknown) { this.error = error instanceof Error ? error.message : '작업에 실패했습니다.'; this.emit(); }
  clearMessage() { this.error = null; this.notice = null; this.emit(); }
  inform(notice: string) { this.notice = notice; this.emit(); }
  async go(page: Page) { await this.flush(); this.page = page; this.emit(); }
  setFilter(filter: LibraryFilter) { this.filter = filter; this.page = 'library'; this.emit(); }
  setSearch(value: string) { this.search = value; this.emit(); }
  async create(kind: Card['body']['kind']) { const card = await this.runtime.repo.insertCard(newCard(kind)); await this.refresh(); await this.open(card.id); }
  async open(id: string) {
    await this.flush();
    const saved = await this.runtime.repo.getCard(id);
    const buffer = await this.runtime.repo.getBuffer(id);
    this.editor = {card: buffer?.card ?? saved, baseRevision: buffer?.baseRevision ?? saved.revision, dirty: !!buffer, status: buffer ? 'buffered' : 'saved'};
    if (buffer && buffer.baseRevision !== saved.revision) this.error = '저장된 카드가 변경되었습니다. 편집 내용은 보존되어 있습니다. 복제하여 저장해 주세요.';
    this.page = 'editor'; this.emit();
  }
  edit(patch: Partial<Card>) {
    if (!this.editor) return;
    this.editor = {...this.editor, card: {...this.editor.card, ...patch}, dirty: true, status: 'saving'};
    clearTimeout(this.bufferTimer);
    this.bufferTimer = setTimeout(() => { void this.flush().catch(error => this.report(error)); }, 300);
    this.emit();
  }
  editWorld(field: keyof World, value: string) {
    const body = this.editor?.card.body;
    if (body?.kind === 'template') this.edit({body: {...body, data: {...body.data, [field]: value}}});
  }
  async flush() {
    clearTimeout(this.bufferTimer);
    const editor = this.editor;
    if (!editor?.dirty) return;
    try {
      await this.runtime.repo.saveBuffer(editor.card, editor.baseRevision);
      if (this.editor?.card === editor.card) this.editor = {...editor, status: 'buffered'};
      this.emit();
    } catch (error) { if (this.editor?.card === editor.card) this.editor = {...editor, status: 'error'}; this.emit(); throw error; }
  }
  save(): Promise<void> {
    if (this.saving) return this.saving;
    this.saving = this.saveCurrent().finally(() => {this.saving = undefined;});
    return this.saving;
  }
  private async saveCurrent() {
    clearTimeout(this.bufferTimer);
    const editor = this.editor;
    if (!editor) return;
    if (!editor.card.title.trim()) throw new Error('이야기 제목을 입력해 주세요.');
    const card = await this.runtime.repo.saveCard({...editor.card, title: editor.card.title.trim(), example: false}, editor.baseRevision);
    // Edits made while the save is in flight remain editable against the newly saved revision.
    if (this.editor?.card === editor.card) this.editor = {card, baseRevision: card.revision, dirty: false, status: 'saved'};
    else if (this.editor?.card.id === card.id) {
      this.editor = {...this.editor, card: {...this.editor.card, revision: card.revision}, baseRevision: card.revision};
      await this.flush();
    }
    await this.refresh();
    this.inform('이야기를 기기에 저장했어요.');
  }
  async duplicate(card: Card) {
    const copy = newCard(card.body.kind);
    const saved = await this.runtime.repo.insertCard({...card, id: copy.id, title: `${card.title.slice(0, 112)} 사본`, revision: 0, example: false, createdAt: copy.createdAt, updatedAt: copy.updatedAt});
    await this.refresh(); await this.open(saved.id); this.inform('별도의 카드로 복제했어요.');
  }
  async favorite(card: Card) {
    await this.flush();
    const latest = await this.runtime.repo.getCard(card.id);
    const saved = await this.runtime.repo.updateMetadata(card.id, {favorite: !latest.favorite});
    if (this.editor?.card.id === saved.id) this.editor = {...this.editor, card: {...this.editor.card, favorite: saved.favorite}, baseRevision: this.editor.baseRevision === saved.revision - 1 ? saved.revision : this.editor.baseRevision};
    await this.refresh();
  }
  async archive(card: Card) {
    await this.flush();
    const latest = await this.runtime.repo.getCard(card.id);
    // Archiving changes card metadata; preserve any unsaved text buffer.
    const saved = await this.runtime.repo.updateMetadata(card.id, {archived: !latest.archived});
    if (this.editor?.card.id === saved.id) this.editor = null;
    this.page = 'library'; await this.refresh(); this.inform(saved.archived ? '보관함으로 옮겼어요.' : '서재로 다시 가져왔어요.');
  }
  async apply(draft: Draft, content: string, field: keyof World) {
    if (!this.editor) return;
    await this.flush();
    if (this.editor.dirty) throw new Error('직접 편집한 내용이 있습니다. 먼저 저장하고 새 초안을 요청하거나 초안을 복사해 주세요.');
    const body = this.editor.card.body;
    if (body.kind !== 'template') throw new Error('코드 카드는 소스 편집기에서 직접 수정해 주세요.');
    const saved = await this.runtime.repo.applyDraft({...draft, content}, {...this.editor.card, body: {...body, data: {...body.data, [field]: content}}});
    this.runtime.creation.markDraftApplied(saved.id, draft.id);
    this.editor = {card: saved, baseRevision: saved.revision, dirty: false, status: 'saved'};
    await this.refresh(); this.inform('초안을 카드에 적용했어요.');
  }
  async startChat(card: Card, forceNew = false) {
    if (this.editor?.card.id === card.id && this.editor.dirty) await this.save();
    else await this.flush();
    const conversations = await this.runtime.repo.conversations(card.id);
    this.conversation = (!forceNew && conversations[0]) || await this.runtime.repo.createConversation(card.id);
    this.page = 'chat'; await this.refresh();
  }
  async openConversation(conversation: Conversation) { await this.flush(); this.conversation = conversation; this.page = 'chat'; this.emit(); }
}
