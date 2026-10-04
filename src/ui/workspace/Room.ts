import type {ChatRow} from '../screenState';
import {workspaceTuning as tuning} from './tuning';
import type {WorkspaceStorage, StoredMessage, MessagePage} from './types';

export type RoomState = {chat: ChatRow; messages: StoredMessage[]; hasOlder: boolean; hasNewer: boolean; ready: boolean; loading: boolean; error: boolean};
export class WorkspaceRoom {
  private state: RoomState;
  private listeners = new Set<() => void>();
  private pending: Promise<void> | undefined;
  private generation = 0;
  lastSequence = 0;
  constructor(private store: WorkspaceStorage, chat: ChatRow) {
    this.state = {chat, messages: chat.messages.map((message, index) => ({...message, sequence: (message as Partial<StoredMessage>).sequence ?? index + 1})),
      hasOlder: false, hasNewer: false, ready: false, loading: false, error: false};
    this.lastSequence = (chat as ChatRow & {lastSequence?: number}).lastSequence ?? this.state.messages.at(-1)?.sequence ?? 0;
  }
  snapshot = () => this.state;
  subscribe = (callback: () => void) => {this.listeners.add(callback); return () => {this.listeners.delete(callback);};};
  private emit() {this.listeners.forEach(callback => callback());}
  setChat(chat: ChatRow) {this.lastSequence = Math.max(this.lastSequence, (chat as ChatRow & {lastSequence?: number}).lastSequence ?? 0);
    this.state = {...this.state, chat: {...chat, messages: this.state.messages}}; this.emit();}
  append(message: StoredMessage) {
    // A read started before this optimistic send must not reintroduce an old window.
    this.generation++;
    const gap = this.state.hasNewer;
    const messages = [...(gap ? [] : this.state.messages).filter(item => item.id !== message.id), message].sort((a, b) => a.sequence - b.sequence);
    this.lastSequence = Math.max(this.lastSequence, message.sequence);
    this.state = {...this.state, messages, chat: {...this.state.chat, messages}, hasOlder: this.state.hasOlder || gap, hasNewer: false}; this.emit();
    // Repeated sends at the bottom need the same bound as manual scrolling.
    this.retain(messages.at(-2)?.id ?? message.id, messages.at(-1)!.id);
  }
  private apply(page: MessagePage, direction: 'replace' | 'older' | 'newer') {
    const byId = new Map((direction === 'replace' ? [] : this.state.messages).map(message => [message.id, message]));
    page.messages.forEach(message => byId.set(message.id, message));
    const messages = [...byId.values()].sort((a, b) => a.sequence - b.sequence);
    this.lastSequence = Math.max(this.lastSequence, messages.at(-1)?.sequence ?? 0);
    this.state = {...this.state, messages, chat: {...this.state.chat, messages}, ready: true, error: false,
      hasOlder: direction === 'newer' ? this.state.hasOlder : page.hasOlder,
      hasNewer: direction === 'older' ? this.state.hasNewer : page.hasNewer};
    this.emit();
  }
  load = async (anchor?: number) => {
    if (!anchor) return this.read('replace', {});
    // Include the anchor even when one message alone consumes the character budget.
    await this.read('replace', {before: anchor + 1});
    if (this.state.hasNewer) await this.newer();
  };
  older = () => !this.state.hasOlder ? Promise.resolve() : this.read('older', {before: this.state.messages[0]!.sequence});
  newer = () => !this.state.hasNewer ? Promise.resolve() : this.read('newer', {after: this.state.messages.at(-1)!.sequence});
  latest = async () => {await this.pending; await this.read('replace', {});};
  async refresh(lastSequence: number, atEnd: boolean) {
    if (lastSequence <= this.lastSequence) return;
    this.lastSequence = lastSequence;
    if (atEnd) await this.latest();
    else {
      this.state = {...this.state, hasNewer: true}; this.emit();
    }
  }
  private read(direction: 'replace' | 'older' | 'newer', cursor: {before?: number; after?: number}): Promise<void> {
    if (this.pending) return this.pending;
    const generation = this.generation;
    this.state = {...this.state, loading: true}; this.emit();
    this.pending = this.store.messages(this.state.chat.id, {...cursor, limit: tuning.messagePage, characters: tuning.messageCharacters})
      .then(page => {if (generation === this.generation) this.apply(page, direction);})
      .catch(() => {this.state = {...this.state, error: true};})
      .finally(() => {this.pending = undefined; this.state = {...this.state, loading: false}; this.emit();});
    return this.pending;
  }
  /** Evict far bodies only after a visible anchor has been supplied by the list. */
  retain(firstVisible: string, lastVisible: string) {
    const rows = this.state.messages;
    if (rows.length <= tuning.retainedMessages && rows.reduce((sum, row) => sum + row.text.length, 0) <= tuning.retainedCharacters) return;
    let first = rows.findIndex(row => row.id === firstVisible), last = rows.findIndex(row => row.id === lastVisible);
    if (first < 0 || last < first) return;
    let characters = rows.slice(first, last + 1).reduce((sum, row) => sum + row.text.length, 0);
    while (last - first + 1 < tuning.retainedMessages) {
      let added = false;
      for (const side of ['before', 'after'] as const) {
        const index = side === 'before' ? first - 1 : last + 1, row = rows[index];
        if (row && last - first + 1 < tuning.retainedMessages && characters + row.text.length <= tuning.retainedCharacters) {
          characters += row.text.length; if (side === 'before') first--; else last++; added = true;
        }
      }
      if (!added) break;
    }
    if (first === 0 && last === rows.length - 1) return;
    const messages = rows.slice(first, last + 1);
    this.state = {...this.state, messages, chat: {...this.state.chat, messages}, hasOlder: this.state.hasOlder || first > 0,
      hasNewer: this.state.hasNewer || last < rows.length - 1}; this.emit();
  }
  dispose() {this.generation++; this.listeners.clear();}
}
