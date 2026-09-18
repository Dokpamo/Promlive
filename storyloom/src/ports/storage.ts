export type SqlValue = string | number | null;
export type SqlRow = Record<string, unknown>;
export interface SqlResult { rows: SqlRow[]; changes: number }
export interface SqlSession { execute(sql: string, params?: readonly SqlValue[]): Promise<SqlResult> }
export interface SqlDatabase extends SqlSession {
  transaction<T>(work: (session: SqlSession) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export interface SqlBackend extends SqlSession {
  persist?(): Promise<void>;
  close(): Promise<void>;
}

// All callers share this queue; a transaction cannot accidentally absorb another caller's write.
export class SerialDatabase implements SqlDatabase {
  private tail: Promise<unknown> = Promise.resolve();
  private failed: Error | null = null;
  constructor(private readonly backend: SqlBackend) {}
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(() => { if (this.failed) throw this.failed; return work(); });
    this.tail = result.catch(() => undefined);
    return result;
  }
  private async persist() {
    try { await this.backend.persist?.(); }
    catch { this.failed = new Error('기기 저장에 실패했습니다. 화면을 다시 열기 전에 저장 공간을 확인해 주세요.'); throw this.failed; }
  }
  execute(sql: string, params: readonly SqlValue[] = []) {
    return this.enqueue(async () => {
      const result = await this.backend.execute(sql, params);
      await this.persist();
      return result;
    });
  }
  transaction<T>(work: (session: SqlSession) => Promise<T>) {
    return this.enqueue(async () => {
      await this.backend.execute('BEGIN IMMEDIATE');
      let committed = false;
      try {
        const result = await work(this.backend);
        await this.backend.execute('COMMIT');
        committed = true;
        await this.persist();
        return result;
      } catch (error) {
        if (!committed) await this.backend.execute('ROLLBACK');
        throw error;
      }
    });
  }
  async close() { await this.tail; await this.backend.close(); }
}
