interface Messages {error: string | null; notice: string | null; noticeId: number}

/** Owns messages independently from navigation, card edits and conversation refreshes. */
export class Notifications {
  private state: Messages = {error: null, notice: null, noticeId: 0};
  private listeners = new Set<() => void>();
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  private update(patch: Partial<Messages>) {
    this.state = {...this.state, ...patch};
    this.listeners.forEach(listener => listener());
  }
  report = (error: unknown) => this.update({error: error instanceof Error ? error.message : '작업에 실패했습니다.'});
  inform = (notice: string) => this.update({notice, noticeId: this.state.noticeId + 1});
  clear = () => this.update({error: null, notice: null});
  dismissNotice(id: number) {
    if (id === this.state.noticeId && this.state.notice !== null) this.update({notice: null});
  }
}
