import type {SqlDatabase, SqlSession} from '../../ports/storage';
import {addFolder, moveFolderEntries, removeFolderEntries, renameFolder, requireFolder, type FolderTree} from '../../features/library/folderTree';
import type {FolderStore, LibraryScope, FolderChange, FolderRemoval} from '../../features/library/FolderLibrary';

export class SqliteLibraryFolderStore implements FolderStore {
  constructor(private readonly db: SqlDatabase) {}
  read = (scope: LibraryScope) => this.db.transaction(tx => this.readIn(tx, scope));
  private async readIn(tx: SqlSession, scope: LibraryScope): Promise<FolderTree> {
    if (scope.kind === 'history' && !(await tx.execute('SELECT id FROM cards WHERE id=?', [scope.cardId])).rows.length) throw new Error('카드를 찾을 수 없어요.');
    const folders = (await tx.execute('SELECT id,name,parent_id AS parentId FROM library_folders WHERE kind=? AND card_id IS ? ORDER BY rowid', [scope.kind, scope.kind === 'history' ? scope.cardId : null])).rows
      .map(row => ({id: String(row.id), name: String(row.name), parentId: row.parentId == null ? null : String(row.parentId)}));
    const items = (await tx.execute(scope.kind === 'card'
      ? 'SELECT c.id,l.folder_id AS folderId FROM cards c LEFT JOIN library_card_locations l ON l.card_id=c.id'
      : 'SELECT c.id,l.folder_id AS folderId FROM conversations c LEFT JOIN library_chat_locations l ON l.conversation_id=c.id WHERE c.card_id=?', scope.kind === 'card' ? [] : [scope.cardId])).rows
      .map(row => ({id: String(row.id), folderId: row.folderId == null ? null : String(row.folderId)}));
    return {folders, items};
  }
  change = (scope: LibraryScope, change: FolderChange) => this.db.transaction(async tx => {
    const before = await this.readIn(tx, scope);
    const after = change.kind === 'create' ? addFolder(before, change.folder, change.ids, change.folderIds)
      : change.kind === 'move' ? moveFolderEntries(before, change.ids, change.folderIds, change.destination)
      : renameFolder(before, change.id, change.name);
    await this.writeChanges(tx, scope, before, after);
    return after;
  });
  /** Called inside the repository's delete transaction, after generation has settled. */
  async removeIn(tx: SqlSession, removal: FolderRemoval, ids: readonly string[], kind: LibraryScope['kind']) {
    if (removal.scope.kind !== kind) throw new Error('목록이 일치하지 않아요.');
    const before = await this.readIn(tx, removal.scope);
    removal.folderIds.forEach(id => requireFolder(before, id));
    if (ids.some(id => !before.items.some(item => item.id === id))) throw new Error('다른 목록의 항목은 삭제할 수 없어요.');
    await this.writeChanges(tx, removal.scope, before, removeFolderEntries(before, [], removal.folderIds));
  }
  private async writeChanges(tx: SqlSession, scope: LibraryScope, before: FolderTree, after: FolderTree) {
    const previous = new Map(before.folders.map(folder => [folder.id, folder]));
    for (const folder of after.folders) {
      const old = previous.get(folder.id);
      if (!old) await tx.execute('INSERT INTO library_folders(id,kind,card_id,name,parent_id) VALUES(?,?,?,?,?)', [folder.id, scope.kind, scope.kind === 'history' ? scope.cardId : null, folder.name, folder.parentId]);
    }
    for (const folder of after.folders) {
      const old = previous.get(folder.id);
      if (old && (old.name !== folder.name || old.parentId !== folder.parentId)) await tx.execute('UPDATE library_folders SET name=?,parent_id=? WHERE id=?', [folder.name, folder.parentId, folder.id]);
    }
    const oldItems = new Map(before.items.map(item => [item.id, item.folderId]));
    const table = scope.kind === 'card' ? 'library_card_locations' : 'library_chat_locations';
    const key = scope.kind === 'card' ? 'card_id' : 'conversation_id';
    for (const item of after.items) {
      if (oldItems.get(item.id) === item.folderId) continue;
      if (item.folderId === null) await tx.execute(`DELETE FROM ${table} WHERE ${key}=?`, [item.id]);
      else await tx.execute(`INSERT INTO ${table}(${key},folder_id) VALUES(?,?) ON CONFLICT(${key}) DO UPDATE SET folder_id=excluded.folder_id`, [item.id, item.folderId]);
    }
    const survivors = new Set(after.folders.map(folder => folder.id));
    for (const folder of before.folders) if (!survivors.has(folder.id)) await tx.execute('DELETE FROM library_folders WHERE id=?', [folder.id]);
  }
}
