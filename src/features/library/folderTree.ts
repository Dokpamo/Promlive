import {z} from 'zod';

export const libraryFolderSchema = z.object({id: z.string().min(1).max(100), name: z.string().trim().min(1).max(40), parentId: z.string().min(1).max(100).nullable().default(null)});
export type LibraryFolder = z.infer<typeof libraryFolderSchema>;
export interface FolderItem {id: string; folderId: string | null}
export interface FolderTree {folders: LibraryFolder[]; items: FolderItem[]}

export function folderPath(value: Pick<FolderTree, 'folders'>, id: string | null): LibraryFolder[] {
  const path: LibraryFolder[] = [], visited = new Set<string>();
  while (id && !visited.has(id)) {
    const folder = value.folders.find(item => item.id === id);
    if (!folder) break;
    path.unshift(folder); visited.add(id); id = folder.parentId;
  }
  return path;
}
export function nextFolderName(folders: readonly Pick<LibraryFolder, 'name'>[]): string {
  const names = new Set(folders.map(folder => folder.name));
  let number = 1;
  while (names.has(`새폴더 ${number}`)) number++;
  return `새폴더 ${number}`;
}
export function canMoveFolders(value: Pick<FolderTree, 'folders'>, ids: readonly string[], destination: string | null) {
  return !folderPath(value, destination).some(folder => ids.includes(folder.id));
}
export function requireFolder(value: Pick<FolderTree, 'folders'>, id: string | null) {
  if (id !== null && !value.folders.some(folder => folder.id === id)) throw new Error('폴더를 찾을 수 없어요.');
}
export function moveFolderEntries<T extends FolderTree>(value: T, ids: readonly string[], folderIds: readonly string[], destination: string | null): T {
  requireFolder(value, destination);
  if (ids.some(id => !value.items.some(item => item.id === id))) throw new Error('항목을 찾을 수 없어요.');
  folderIds.forEach(id => requireFolder(value, id));
  if (!canMoveFolders(value, folderIds, destination)) throw new Error('폴더를 자기 자신이나 하위 폴더로 옮길 수 없어요.');
  // Selected descendants travel with their parent instead of being flattened.
  const roots = value.folders.filter(folder => folderIds.includes(folder.id) && canMoveFolders(value, folderIds, folder.parentId));
  const rootIds = roots.map(folder => folder.id);
  const names = new Set(value.folders.filter(folder => folder.parentId === destination && !rootIds.includes(folder.id)).map(folder => folder.name.toLocaleLowerCase()));
  for (const folder of roots) {
    const name = folder.name.toLocaleLowerCase();
    if (names.has(name)) throw new Error('같은 이름의 폴더가 있어요.');
    names.add(name);
  }
  return {...value,
    folders: value.folders.map(folder => rootIds.includes(folder.id) ? {...folder, parentId: destination} : folder),
    items: value.items.map(item => ids.includes(item.id) && canMoveFolders(value, rootIds, item.folderId) ? {...item, folderId: destination} : item),
  };
}
export function addFolder<T extends FolderTree>(value: T, input: LibraryFolder, ids: readonly string[], folderIds: readonly string[]): T {
  const folder = libraryFolderSchema.parse(input);
  requireFolder(value, folder.parentId);
  if (value.folders.some(item => item.parentId === folder.parentId && item.name.toLocaleLowerCase() === folder.name.toLocaleLowerCase())) throw new Error('같은 이름의 폴더가 있어요.');
  return moveFolderEntries({...value, folders: [...value.folders, folder]}, ids, folderIds, folder.id);
}
export function renameFolder<T extends FolderTree>(value: T, id: string, name: string): T {
  const parsed = libraryFolderSchema.shape.name.parse(name);
  requireFolder(value, id);
  const folder = value.folders.find(item => item.id === id)!;
  if (value.folders.some(item => item.id !== id && item.parentId === folder.parentId && item.name.toLocaleLowerCase() === parsed.toLocaleLowerCase())) throw new Error('같은 이름의 폴더가 있어요.');
  return {...value, folders: value.folders.map(item => item.id === id ? {...item, name: parsed} : item)};
}
/** Only explicitly selected entries are deleted; other contents keep their ancestry. */
export function removeFolderEntries<T extends FolderTree>(value: T, ids: readonly string[], folderIds: readonly string[]): T {
  const survivingParent = (parent: string | null): string | null => {
    const visited = new Set<string>();
    while (parent && folderIds.includes(parent) && !visited.has(parent)) {
      visited.add(parent); parent = value.folders.find(folder => folder.id === parent)?.parentId ?? null;
    }
    return parent;
  };
  return {...value,
    items: value.items.filter(item => !ids.includes(item.id)).map(item => ({...item, folderId: survivingParent(item.folderId)})),
    folders: value.folders.filter(item => !folderIds.includes(item.id)).map(item => ({...item, parentId: survivingParent(item.parentId)})),
  };
}
