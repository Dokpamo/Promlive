import {newId, type Card} from '../cards/model';
import type {ChatSessionStore, ComposerDraft} from './sessionStore';
import type {CreationService} from './service';

export type SendState = {kind: 'idle'} | {kind: 'accepting' | 'streaming' | 'cancelling'; requestId: string} | {kind: 'failed'; message: string};
export interface ComposerAction {kind: 'send' | 'cancel'; enabled: boolean; label: string}
export interface ChatSessionState {draft: ComposerDraft; ready: boolean; send: SendState; messageRevision: number; error: string | null}
const emptyDraft = (): ComposerDraft => ({text: '', revision: 0, acceptedRevision: -1});

export function composerAction(state: ChatSessionState): ComposerAction {
  if (state.send.kind === 'streaming' || state.send.kind === 'cancelling') return {kind: 'cancel', enabled: state.send.kind === 'streaming', label: state.send.kind === 'cancelling' ? '중단 중' : '응답 중단'};
  return {kind: 'send', enabled: state.ready && state.send.kind !== 'accepting' && !!state.draft.text.trim(), label: state.send.kind === 'accepting' ? '전송 중' : '메시지 보내기'};
}

/** Owns a room's draft and submission, independently of whether its screen is mounted. */
export class ChatSession {
  private state: ChatSessionState = {draft: emptyDraft(), ready: false, send: {kind: 'idle'}, messageRevision: 0, error: null};
  private readonly listeners = new Set<() => void>();
  private loading: Promise<void> | undefined;
  private timer?: ReturnType<typeof setTimeout>;
  private pending: {id: string; revision: number} | undefined;
  private task: Promise<void> | undefined;
  private deleted = false;
  constructor(readonly conversationId: string, private card: Card, private readonly store: ChatSessionStore, private readonly creation: CreationService, private readonly notify: (error?: unknown, offline?: boolean) => void) {}
  updateCard(card: Card) {this.card = card;}
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  snapshot = () => this.state;
  private update(patch: Partial<ChatSessionState>) {this.state = {...this.state, ...patch}; this.listeners.forEach(listener => listener());}
  load = () => this.loading ??= this.store.loadComposerDraft(this.conversationId).then(draft => {if (!this.deleted) this.update({draft, ready: true});}).catch(error => {this.loading = undefined; this.fail(error);});
  change = (text: string) => {
    if (!this.state.ready || this.deleted) return;
    this.update({draft: {...this.state.draft, text, revision: this.state.draft.revision + 1}, error: null});
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {void this.flush().catch(() => {});}, 300);
  };
  flush = async () => {
    clearTimeout(this.timer);
    if (!this.state.ready || this.deleted) return;
    const {text, revision, acceptedRevision} = this.state.draft;
    if (revision > acceptedRevision) {
      try {await this.store.writeComposerDraft(this.conversationId, {text, revision});}
      catch (error) {this.fail(error); throw error;}
    }
  };
  private fail(error: unknown) {const message = error instanceof Error ? error.message : '채팅을 저장하지 못했어요.'; this.update({error: message}); this.notify(error);}
  send = () => {
    if (this.task || this.deleted || !composerAction(this.state).enabled || composerAction(this.state).kind !== 'send') return this.task ?? Promise.resolve();
    const captured = this.state.draft;
    if (this.pending?.revision !== captured.revision) this.pending = {id: newId('submission'), revision: captured.revision};
    const requestId = this.pending.id;
    const online = this.creation.coordinator.provider.connected;
    this.update({send: {kind: 'accepting', requestId}, error: null});
    clearTimeout(this.timer);
    this.task = this.creation.send(this.card, this.conversationId, captured.text, requestId, () => {
      const current = this.state.draft;
      this.update({draft: {...current, text: current.revision === captured.revision ? '' : current.text, acceptedRevision: captured.revision}, send: online ? {kind: 'streaming', requestId} : {kind: 'accepting', requestId}, messageRevision: this.state.messageRevision + 1});
      this.notify(undefined, !online);
    }, captured.revision).then(() => {
      this.pending = undefined;
      this.update({send: {kind: 'idle'}});
    }).catch(error => {
      const message = error instanceof Error ? error.message : '전송하지 못했어요.';
      this.update({send: {kind: 'failed', message}}); this.fail(error);
    }).finally(() => {
      this.task = undefined;
      this.update({messageRevision: this.state.messageRevision + 1});
      this.notify();
    });
    return this.task;
  };
  cancel = () => {
    if (this.state.send.kind !== 'streaming') return;
    const requestId = this.state.send.requestId;
    this.update({send: {kind: 'cancelling', requestId}});
    this.creation.cancel(requestId);
  };
  dispose() {this.deleted = true; clearTimeout(this.timer); this.cancel(); this.listeners.clear();}
}

export class ChatSessions {
  private readonly sessions = new Map<string, ChatSession>();
  constructor(private readonly store: ChatSessionStore, private readonly creation: CreationService, private readonly notify: (error?: unknown, offline?: boolean) => void) {}
  get(id: string, card: Card) {
    let session = this.sessions.get(id);
    if (!session) {session = new ChatSession(id, card, this.store, this.creation, this.notify); this.sessions.set(id, session);}
    else session.updateCard(card);
    return session;
  }
  forget(ids: readonly string[]) {for (const id of ids) {this.sessions.get(id)?.dispose(); this.sessions.delete(id);}}
}
