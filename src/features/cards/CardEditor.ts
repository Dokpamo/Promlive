import type {Card, Draft, World} from './model';
import type {CardEditorStore, CardMetadataPatch} from './store';
import {rebaseEditorChanges} from './editorState';

export interface Editor {card: Card; baseRevision: number; dirty: boolean; status: 'saved' | 'saving' | 'buffered' | 'error'}
export interface AssistantForm {prompt: string; mode: Draft['kind']; target: keyof World; content: string; sourceContent: string; draftId: string}
interface EditorEvents {
  report: (error: unknown) => void;
  committed: (card: Card, draft?: Draft) => Promise<void>;
}

/** Card editing, recovery buffers and draft application share one revision owner. */
export class CardEditor {
  private current: Editor | null = null;
  private session = 0;
  private opening = 0;
  private version = 0;
  private listeners = new Set<() => void>();
  private bufferTimer: ReturnType<typeof setTimeout> | undefined;
  private bufferWrites: Promise<void> = Promise.resolve();
  private saving = new Map<number, {card: Card | undefined; task: Promise<void>}>();
  private forms = new Map<string, AssistantForm>();
  private removing = new Set<string>();
  private applying = new Set<Promise<void>>();
  constructor(private readonly store: CardEditorStore, private readonly events: EditorEvents) {}

  get state() {return this.current;}
  snapshot = () => this.version;
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  private emit() {this.version++; this.listeners.forEach(listener => listener());}
  assistantForm(id: string) {
    let form = this.forms.get(id);
    if (!form) {form = {prompt: '', mode: 'writing', target: 'world', content: '', sourceContent: '', draftId: ''}; this.forms.set(id, form);}
    return form;
  }
  editAssistant(id: string, patch: Partial<AssistantForm>) {this.forms.set(id, {...this.assistantForm(id), ...patch}); this.emit();}
  drafts(id: string) {return this.store.drafts(id);}

  async open(id: string, isRequested: () => boolean = () => true) {
    if (this.removing.has(id)) return false;
    const opening = ++this.opening;
    while (opening === this.opening && isRequested()) {
      const before = this.current;
      await this.flush();
      // Finish the old editor's commit/rebase before reading its recovery buffer.
      // A load request does not take ownership until it actually becomes visible.
      await this.saving.get(this.session)?.task;
      const saved = await this.store.getCard(id);
      const buffer = await this.store.getBuffer(id);
      if (opening !== this.opening || !isRequested() || this.removing.has(id)) return false;
      // The previous card remains editable while reads wait. Flush edits made
      // during that wait before replacing it (and reread when reopening it).
      if (before?.card !== this.current?.card) continue;
      this.session++;
      this.current = {card: buffer?.card ?? saved, baseRevision: buffer?.baseRevision ?? saved.revision, dirty: !!buffer, status: buffer ? 'buffered' : 'saved'};
      if (buffer && buffer.baseRevision !== saved.revision) this.events.report(new Error('저장된 카드가 변경되었습니다. 편집 내용은 보존되어 있습니다. 복제하여 저장해 주세요.'));
      this.emit();
      return true;
    }
    return false;
  }
  edit(patch: Partial<Card>) {
    if (!this.current || this.removing.has(this.current.card.id)) return;
    this.current = {...this.current, card: {...this.current.card, ...patch}, dirty: true, status: 'saving'};
    clearTimeout(this.bufferTimer);
    this.bufferTimer = setTimeout(() => {void this.flush().catch(this.events.report);}, 300);
    this.emit();
  }
  editWorld(field: keyof World, value: string) {
    const body = this.current?.card.body;
    if (body?.kind === 'template') this.edit({body: {...body, data: {...body.data, [field]: value}}});
  }
  flush(): Promise<void> {
    clearTimeout(this.bufferTimer);
    const captured = this.current;
    if (!captured?.dirty) return this.bufferWrites;
    const committing = this.saving.get(this.session);
    if (committing?.card === captured.card) return committing.task;
    const task = this.bufferWrites.then(async () => {
      // Buffer writes cannot overtake one another. Prefer edits already made
      // while an older write waited, without borrowing another card's state.
      const editor = this.current?.card.id === captured.card.id ? this.current : captured;
      if (!editor.dirty) return;
      try {
        await this.store.saveBuffer(editor.card, editor.baseRevision);
        if (this.current?.card === editor.card) this.current = {...editor, status: 'buffered'};
      } catch (error) {
        if (this.current?.card === editor.card) this.current = {...editor, status: 'error'};
        throw error;
      } finally {this.emit();}
    });
    // Failure is returned to the caller, but never poisons the next retry.
    this.bufferWrites = task.catch(() => {});
    return task;
  }
  save(): Promise<void> {
    if (this.current && this.removing.has(this.current.card.id)) return Promise.reject(new Error('삭제 중인 카드입니다.'));
    const session = this.session;
    const pending = this.saving.get(session);
    if (pending) return pending.task;
    const task = this.saveCurrent(session).finally(() => {this.saving.delete(session);});
    this.saving.set(session, {card: this.current?.card, task});
    return task;
  }
  private async saveCurrent(session: number) {
    clearTimeout(this.bufferTimer);
    const editor = this.current;
    if (!editor) return;
    if (!editor.card.title.trim()) throw new Error('이야기 제목을 입력해 주세요.');
    await this.bufferWrites;
    const saved = await this.store.saveCard({...editor.card, title: editor.card.title.trim(), example: false}, editor.baseRevision);
    await this.bufferWrites;
    await this.finishWrite(session, editor, saved);
    await this.events.committed(saved);
  }
  private async finishWrite(session: number, before: Editor, saved: Card) {
    const current = this.current;
    if (session !== this.session || current?.card.id !== saved.id || current.baseRevision > saved.revision) return;
    if (current.card === before.card) {
      this.current = {card: saved, baseRevision: saved.revision, dirty: false, status: 'saved'};
    } else {
      this.current = {...current, card: rebaseEditorChanges(before.card, current.card, saved), baseRevision: saved.revision};
      await this.flush();
    }
    this.emit();
  }
  updateMetadata(saved: Card, patch?: CardMetadataPatch) {
    if (this.current?.card.id !== saved.id) return;
    this.current = {...this.current, card: {...this.current.card, favorite: saved.favorite, archived: saved.archived, pinnedAt: saved.pinnedAt, ...(patch?.title !== undefined ? {title: saved.title} : {})}, baseRevision: this.current.baseRevision === saved.revision - 1 ? saved.revision : this.current.baseRevision};
    this.emit();
  }
  async settle() {
    await Promise.allSettled([...this.saving.values()].map(item => item.task).concat([...this.applying]));
    await this.flush();
  }
  async withRemoval<T>(ids: readonly string[], removeStored: () => Promise<T>): Promise<T> {
    ids.forEach(id => this.removing.add(id));
    this.opening++;
    try {
      await this.settle();
      const result = await removeStored();
      for (const id of ids) {this.close(id); this.forms.delete(id);}
      return result;
    } finally {ids.forEach(id => this.removing.delete(id));}
  }
  close(id: string) {
    if (this.current?.card.id !== id) return;
    clearTimeout(this.bufferTimer);
    this.opening++;
    this.session++;
    this.current = null;
    this.emit();
  }
  apply(draft: Draft, content: string, field: keyof World): Promise<void> {
    if (this.removing.has(draft.cardId)) return Promise.reject(new Error('삭제 중인 카드입니다.'));
    const task = this.applyCurrent(draft, content, field).finally(() => this.applying.delete(task));
    this.applying.add(task);
    return task;
  }
  private async applyCurrent(draft: Draft, content: string, field: keyof World) {
    if (!this.current) return;
    const session = this.session;
    await this.flush();
    const editor = this.current;
    if (session !== this.session || !editor) return;
    if (editor.dirty) throw new Error('직접 편집한 내용이 있습니다. 먼저 저장하고 새 초안을 요청하거나 초안을 복사해 주세요.');
    const body = editor.card.body;
    if (body.kind !== 'template') throw new Error('코드 카드는 소스 편집기에서 직접 수정해 주세요.');
    const saved = await this.store.applyDraft({...draft, content}, {...editor.card, body: {...body, data: {...body.data, [field]: content}}});
    await this.bufferWrites;
    await this.finishWrite(session, editor, saved);
    await this.events.committed(saved, draft);
  }
}
