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
