import {workspaceTuning as tuning} from './tuning';
import type {WorkspaceStorage, CollectionQuery, CollectionPage, CollectionRow} from './types';

export type CollectionState = CollectionPage & {ready: boolean; loading: boolean; error: boolean};
export class WorkspaceCollection {
  private state: CollectionState;
  private listeners = new Set<() => void>();
  private pending: Promise<void> | null = null;
  private generation = 0;
  private stale = true;
  constructor(private store: WorkspaceStorage, readonly query: CollectionQuery, private initialize: () => Promise<void>,
    cached: CollectionRow[] = []) {this.state = {rows: cached, next: null, ready: false, loading: false, error: false};}
  snapshot = () => this.state;
  get observed() {return this.listeners.size > 0;}
  subscribe = (callback: () => void) => {this.listeners.add(callback); return () => {this.listeners.delete(callback);};};
  private update(patch: Partial<CollectionState>) {this.state = {...this.state, ...patch}; this.listeners.forEach(callback => callback());}
  load = (): Promise<void> => {
    if (this.state.ready && !this.stale) return Promise.resolve();
    return this.refresh();
  };
  refresh = (): Promise<void> => {
    if (this.pending) return this.pending;
    const generation = ++this.generation;
    this.stale = false;
    this.update({loading: true});
    this.pending = (async () => {
      await this.initialize();
      // Revalidate only the visited lightweight range, including rows that left
      // a filter in another window. Never hydrate card documents here.
      const wanted = Math.max(tuning.listPage, this.state.rows.length);
      const page = await this.store.list(this.query, null, tuning.listPage);
      while (page.next && page.rows.length < wanted) {
        const more = await this.store.list(this.query, page.next, tuning.listPage);
        page.rows.push(...more.rows); page.next = more.next;
      }
      if (generation !== this.generation) return;
      const previous = new Map(this.state.rows.map(row => [row.id, row]));
      const head = page.rows.map(row => {const old = previous.get(row.id); return old && JSON.stringify(old) === JSON.stringify(row) ? old : row;});
      this.update({rows: head, next: page.next, ready: true, error: false});
    })().catch(() => {this.stale = true; this.update({error: true});}).finally(() => {this.pending = null; this.update({loading: false});});
    return this.pending;
  };
  invalidate(id?: string) {
    this.stale = true;
    this.generation++;
    if (id) this.update({rows: this.state.rows.filter(row => row.id !== id)});
    if (this.observed) {
      if (this.pending) void this.pending.then(() => this.load());
      else void this.load();
    }
  }
  loadMore = (): Promise<void> => {
    if (!this.state.ready) return this.load();
    if (this.pending || !this.state.next) return this.pending ?? Promise.resolve();
    const cursor = this.state.next;
    const generation = this.generation;
    this.update({loading: true});
    this.pending = this.store.list(this.query, cursor, tuning.listPage).then(page => {
      if (generation !== this.generation) return;
      const seen = new Set(this.state.rows.map(row => row.id));
      this.update({rows: [...this.state.rows, ...page.rows.filter(row => !seen.has(row.id))], next: page.next, error: false});
    }).catch(() => this.update({error: true})).finally(() => {this.pending = null; this.update({loading: false});});
    return this.pending;
  };
  /** Inactive query caches retain one small page, never card documents/history. */
  release() {
    if (this.state.rows.length <= tuning.listPage) return;
    const rows = this.state.rows.slice(0, tuning.listPage), last = rows.at(-1)!;
    this.update({rows, next: {id: last.id, sort: last.sort}});
  }
}
