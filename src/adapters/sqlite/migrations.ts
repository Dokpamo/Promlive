import type {SqlDatabase} from '../../ports/storage';
export const migrations = [
  [
    'CREATE TABLE cards (id TEXT PRIMARY KEY, title TEXT NOT NULL, kind TEXT NOT NULL, revision INTEGER NOT NULL, updated_at INTEGER NOT NULL, favorite INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0, document TEXT NOT NULL)',
    'CREATE TABLE conversations (id TEXT PRIMARY KEY, card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, title TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)',
    'CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, sequence INTEGER NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL, request_id TEXT, error TEXT, created_at INTEGER NOT NULL, UNIQUE(conversation_id, sequence))',
    'CREATE UNIQUE INDEX unique_assistant_request ON messages(request_id) WHERE request_id IS NOT NULL AND role = \'assistant\'',
    'CREATE INDEX message_page ON messages(conversation_id, sequence DESC)',
    'CREATE TABLE ai_drafts (id TEXT PRIMARY KEY, card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, document TEXT NOT NULL)',
    'CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  ],
  [
    'CREATE TABLE editor_buffers (card_id TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE, base_revision INTEGER NOT NULL, document TEXT NOT NULL, updated_at INTEGER NOT NULL)',
    'CREATE INDEX card_library ON cards(archived, updated_at DESC)',
  ],
  [
    'ALTER TABLE conversations ADD COLUMN pinned_at INTEGER',
    'ALTER TABLE conversations ADD COLUMN title_edited INTEGER NOT NULL DEFAULT 0',
    'CREATE INDEX conversation_history ON conversations(card_id, pinned_at DESC, updated_at DESC)',
  ],
] as const;
export const DATABASE_VERSION = migrations.length;
export async function migrate(db: SqlDatabase, steps: readonly (readonly string[])[] = migrations) {
  await db.execute('PRAGMA foreign_keys = ON');
  const current = Number((await db.execute('PRAGMA user_version')).rows[0]?.user_version ?? 0);
  if (current > steps.length) throw new Error('더 새로운 앱에서 저장한 데이터입니다. 앱을 업데이트해 주세요.');
  // SQLite transactional DDL leaves the original schema and content intact on failure.
  await db.transaction(async tx => {
    for (let version = current; version < steps.length; version++) {
      for (const sql of steps[version] ?? []) await tx.execute(sql);
      await tx.execute(`PRAGMA user_version = ${version + 1}`);
    }
  });
}
