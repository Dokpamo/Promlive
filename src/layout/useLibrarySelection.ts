import {useEffect, useState, useSyncExternalStore} from 'react';
import type {FolderLibrary} from '../features/library/FolderLibrary';
import type {FolderTree, LibraryFolder} from '../features/library/folderTree';
import {nextFolderName} from '../features/library/folderTree';
import type {ListItem} from './itemListMotion';

export type LibraryEntry<T extends ListItem> = ListItem & ({kind: 'item'; item: T} | {kind: 'folder'; folder: LibraryFolder});
export type LibraryTargets = {ids: string[]; folderIds: string[]};
export type LibraryOrganization = LibraryTargets & ({screen: 'choose'} | {screen: 'create'; name: string; parentId: string | null});
const emptyState = {value: {folders: [], items: []} as FolderTree, ready: false, error: ''};
const noopSubscribe = () => () => {};
const emptySnapshot = () => emptyState;

export function useLibrarySelection<T extends ListItem>(allItems: readonly T[], library: FolderLibrary | undefined, active: boolean, report: (error: unknown) => void) {
  const state = useSyncExternalStore(library?.subscribe ?? noopSubscribe, library?.snapshot ?? emptySnapshot);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [organize, setOrganize] = useState<LibraryOrganization | null>(null);
  const [deletion, setDeletion] = useState<(LibraryTargets & {detail: string}) | null>(null);
  useEffect(() => {if (active) void library?.refresh().catch(report);}, [library, allItems, active, report]);
  useEffect(() => {if (state.ready && folderId && !state.value.folders.some(folder => folder.id === folderId)) setFolderId(null);}, [state, folderId]);
  const entries: LibraryEntry<T>[] = [
    ...state.value.folders.map(folder => ({id: `folder:${folder.id}`, title: folder.name, kind: 'folder' as const, folder})),
    ...allItems.map(item => ({id: `item:${item.id}`, title: item.title, pinnedAt: item.pinnedAt, kind: 'item' as const, item})),
  ];
  const selectedEntries = entries.filter(entry => selected?.has(entry.id));
  useEffect(() => {if (selected && !selectedEntries.length) setSelected(null);}, [selected, selectedEntries.length]);
  const toggle = (entry: LibraryEntry<T>) => setSelected(current => {
    const next = new Set(current);
    if (next.has(entry.id)) next.delete(entry.id); else next.add(entry.id);
    return next.size ? next : null;
  });
  const targets = (entries: LibraryEntry<T>[]): LibraryTargets => ({
    ids: entries.flatMap(entry => entry.kind === 'item' ? [entry.item.id] : []),
    folderIds: entries.flatMap(entry => entry.kind === 'folder' ? [entry.folder.id] : []),
  });
  const requestMove = (entries: LibraryEntry<T>[]) => {
    if (!entries.length || !state.ready) return;
    const chosen = targets(entries);
    setOrganize(state.value.folders.length ? {...chosen, screen: 'choose'} : {...chosen, screen: 'create', parentId: folderId, name: nextFolderName(state.value.folders.filter(folder => folder.parentId === folderId))});
  };
  const requestDelete = (entries: LibraryEntry<T>[]) => {
    if (!entries.length) return;
    const chosen = targets(entries);
    const detail = entries.length === 1 ? `“${entries[0]!.title}”` : '선택한 항목이 삭제돼요.';
    setDeletion({...chosen, detail: detail + (chosen.folderIds.length ? '\n폴더 안의 선택하지 않은 항목은 상위 목록으로 옮겨져요.' : '')});
  };
  return {...state, folderId, setFolderId, entries, selected, selectedEntries, setSelected, toggle, organize, setOrganize, deletion, setDeletion, requestMove, requestDelete};
}
