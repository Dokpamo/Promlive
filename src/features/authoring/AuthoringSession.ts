import {newId, type Card} from '../cards/model';
import {AuthoringAssistant} from './AuthoringAssistant';
import {changeFields, fieldLabel, fieldValue, structuredField, type AuthoringField, type AuthoringMessage, type AuthoringProject} from './model';
import type {AuthoringStore} from './store';

export interface StudioState {
  project: AuthoringProject | null; saving: boolean; generating: boolean; publishing: boolean;
  error: string | null; focusedField: AuthoringField | null;
}
/** The studio's sole draft owner. Views never write card content or receipts themselves. */
export class AuthoringSession {
  private state: StudioState = {project: null, saving: false, generating: false, publishing: false, error: null, focusedField: null};
  private listeners = new Set<() => void>();
  private storageRevision = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private timer?: ReturnType<typeof setTimeout>;
  private request: {id: string; messageId: string} | null = null;
  private closed = false;
  private closing = false;
  private lastInstruction = '';
  constructor(readonly cardId: string, readonly store: AuthoringStore, readonly assistant: AuthoringAssistant) {}
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  snapshot = () => this.state;
  private emit(patch: Partial<StudioState>) {this.state = {...this.state, ...patch}; this.listeners.forEach(listener => listener());}
  private update(project: AuthoringProject) {
    if (this.closed || this.closing) return;
    this.emit({project, saving: true, error: null});
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {void this.flush().catch(() => {});}, 250);
  }
  async load() {
    const stored = await this.store.open(this.cardId);
    if (this.closed) return;
    this.storageRevision = stored.storageRevision;
    const interrupted = stored.project.messages.some(m => m.status === 'generating');
    const project = {...stored.project, messages: stored.project.messages.map(m => m.status === 'generating' ? {...m, status: 'interrupted' as const, text: '앱이 종료되어 제작을 중단했어요. 초안은 유지했어요.'} : m)};
    this.emit({project});
    if (interrupted) {this.update(project); await this.flush();}
  }
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task);
    this.queue = result.catch(() => {});
    return result;
  }
  flush = async () => {
    clearTimeout(this.timer);
    return this.enqueue(async () => {
      const project = this.state.project;
      if (!project || !this.state.saving) return;
      try {
        this.storageRevision = await this.store.save(project, this.storageRevision);
        if (this.state.project === project) this.emit({saving: false, error: null});
      } catch (error) {
        this.emit({error: error instanceof Error ? error.message : '초안을 저장하지 못했어요.'});
        throw error;
      }
    });
  };
  setField = (field: AuthoringField, value: string) => {
    const p = this.state.project;
    if (!p || this.closed || this.closing || this.state.publishing || fieldValue(p.draft, field) === value) return;
    const draft = changeFields(p.draft, [{field, value}]);
    if (fieldValue(draft, field) !== fieldValue(p.draft, field)) this.update({...p, draft, revision: p.revision + 1});
  };
  setImage = (id: string) => {
    const p = this.state.project;
    if (p && !this.closed && !this.closing && !this.state.publishing) this.update({...p, draft: {...p.draft, coverAssetId: id}, revision: p.revision + 1});
  };
  setPrompt = (prompt: string) => {const p = this.state.project; if (p && !this.state.publishing) this.update({...p, prompt: prompt.slice(0, 8000)});};
  setView = (view: AuthoringProject['view']) => {const p = this.state.project; if (p && !this.state.publishing) this.update({...p, view});};
  setTarget = (target: AuthoringField | null) => {const p = this.state.project; if (p && !this.state.publishing) this.update({...p, target});};
  setFocusedField = (focusedField: AuthoringField | null) => this.emit({focusedField});
  private message(id: string, patch: Partial<AuthoringMessage>) {
    const p = this.state.project;
    if (p && !this.closed) this.update({...p, messages: p.messages.map(m => m.id === id ? {...m, ...patch} : m)});
  }
  cancel = () => {
    const job = this.request;
    if (!job) return;
    this.request = null;
    this.assistant.cancel(job.id);
    this.message(job.messageId, {status: 'cancelled', text: '제작을 중단했어요. 기존 초안은 유지했어요.'});
    this.emit({generating: false});
  };
  retry = () => this.generate(this.lastInstruction);
  generate = async (provided?: string) => {
    const captured = this.state.project;
    const instruction = (provided ?? captured?.prompt ?? '').trim();
    if (!captured || !instruction || this.request || this.closed || this.closing || this.state.publishing) return;
    if (!this.assistant.connected) {this.emit({error: 'AI 설정에서 모델을 연결해 주세요. 직접 편집은 바로 사용할 수 있어요.'}); return;}
    this.lastInstruction = instruction;
    const id = newId('authoring'); const messageId = newId('authoring_message');
    const job = {id, messageId}; this.request = job;
    const readSet = this.assistant.capture(captured);
    this.update({...captured, prompt: provided ? captured.prompt : '', messages: [...captured.messages,
      {id: newId('authoring_message'), role: 'user', text: instruction, status: 'completed', createdAt: Date.now()},
      {id: messageId, role: 'assistant', text: '', status: 'generating', createdAt: Date.now()},
    ].slice(-300) as AuthoringMessage[]});
    this.emit({generating: true});
    try {
      await this.flush();
      if (this.request !== job || this.closed) return;
      const result = await this.assistant.generate(captured, instruction, id, readSet);
      if (this.request !== job || this.closed) return;
      const p = this.state.project!;
      if (result.kind !== 'change') this.message(messageId, {text: result.message, status: 'completed'});
      else if (readSet.some(item => fieldValue(p.draft, item.field) !== item.value) || result.changes.some(item => item.field === this.state.focusedField || item.field === 'structure' && this.state.focusedField && structuredField(this.state.focusedField))) {
        this.message(messageId, {text: '요청 중에 관련 내용을 수정하고 있어 적용하지 않았어요. 지금 초안을 기준으로 다시 요청할 수 있어요.', status: 'conflict'});
      } else {
        const candidate = changeFields(p.draft, result.changes);
        const changes = result.changes.map(item => ({field: item.field, value: fieldValue(candidate, item.field)})).filter(item => fieldValue(p.draft, item.field) !== item.value);
        if (!changes.length) this.message(messageId, {text: '현재 설정과 같아서 변경할 내용이 없어요.', status: 'completed'});
        else {
          const changeId = newId('change');
          const before = changes.map(item => ({field: item.field, value: fieldValue(p.draft, item.field)}));
          const revision = p.revision + 1;
          this.update({...p, draft: changeFields(p.draft, changes), revision,
            changes: [...p.changes, {id: changeId, before, after: changes, revision, undone: false}].slice(-100),
            messages: p.messages.map(m => m.id === messageId ? {...m, text: result.message || `${changes.map(item => fieldLabel(item.field)).join(' · ')} 수정`, changeId, status: 'applied'} : m),
          });
        }
      }
      await this.flush();
    } catch (error) {
      if (this.request === job && !this.closed) {
        // The content and receipt are one pending document. A disk failure must
        // never turn an in-memory applied edit into a claim that nothing changed.
        if (this.state.project?.messages.some(m => m.id === messageId && m.status === 'applied')) {
          this.emit({error: '변경 내용을 기기에 저장하지 못했어요. 화면의 초안은 유지했어요. 저장을 다시 시도해 주세요.'});
          return;
        }
        const text = error instanceof Error && error.name !== 'ZodError' && !(error instanceof SyntaxError) ? error.message : '변경 내용을 확인하지 못해 적용하지 않았어요. 다시 요청해 주세요.';
        this.message(messageId, {text, status: 'failed'});
        // Preserve a disk failure; a later retry writes the same complete document.
        this.emit({error: text});
        try {await this.flush();} catch { /* The editable draft stays in memory. */ }
      }
    } finally {if (this.request === job) {this.request = null; this.emit({generating: false});}}
  };
  undo = async (id: string) => {
    const p = this.state.project;
    const receipt = p?.changes.find(c => c.id === id && !c.undone);
    if (!p || !receipt || this.closed || this.closing || this.state.publishing) return;
    if (receipt.after.some(c => fieldValue(p.draft, c.field) !== c.value || this.state.focusedField === c.field || c.field === 'structure' && this.state.focusedField && structuredField(this.state.focusedField))) {
      this.emit({error: '그 뒤에 직접 수정한 항목이 있어요. 현재 내용을 보호하기 위해 되돌리지 않았어요.'}); return;
    }
    this.update({...p, draft: changeFields(p.draft, receipt.before), revision: p.revision + 1, changes: p.changes.map(c => c.id === id ? {...c, undone: true} : c)});
    await this.flush();
  };
  publish = async (): Promise<Card> => {
    if (this.state.generating || this.state.publishing || !this.state.project || this.closed || this.closing) throw new Error('진행 중인 제작을 먼저 마쳐 주세요.');
    this.emit({publishing: true, error: null});
    try {
      await this.flush();
      return await this.enqueue(async () => {
        const result = await this.store.publish(this.state.project!, this.storageRevision);
        this.storageRevision = result.storageRevision;
        this.emit({project: result.project, saving: false});
        return result.card;
      });
    } catch (error) {this.emit({error: error instanceof Error ? error.message : '카드를 완성하지 못했어요.'}); throw error;}
    finally {this.emit({publishing: false});}
  };
  async close() {
    this.cancel(); this.closing = true;
    try {await this.flush(); this.closed = true; clearTimeout(this.timer); this.listeners.clear();}
    finally {this.closing = false;}
  }
}
