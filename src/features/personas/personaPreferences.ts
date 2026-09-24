import {folderPath, nextFolderName, canMoveFolders, moveFolderEntries, removeFolderEntries, addFolder, renameFolder as renameTreeFolder} from '../library/folderTree';
import {z} from 'zod';
import type {SettingsStore} from '../../ports/settings';
import {newId} from '../cards/model';
import {avatarImageSchema} from '../profile/userProfile';

export const personaSettingsKey = 'personas:v1';
const fields = z.object({name: z.string().trim().min(1).max(40), description: z.string().max(2000), image: avatarImageSchema.nullable()});
const id = z.string().min(1).max(100);
const personaSchema = fields.extend({id, folderId: id.nullable().default(null)});
const folderSchema = z.object({id, name: z.string().trim().min(1).max(40), parentId: id.nullable().default(null)});
export type Persona = z.infer<typeof personaSchema>;
export type PersonaFields = z.infer<typeof fields>;
export type PersonaFolder = z.infer<typeof folderSchema>;
export interface PersonaCollection {
  items: Persona[];
  folders: PersonaFolder[];
  /** Shared sibling order for folders and personas. Older saves retain folders-first order. */
  order?: string[];
  /** Legacy global selection retained for old saves, unused by the library UI. */
  selectedId: string | null;
}
export const defaultPersonas: PersonaCollection = {items: [{id: 'default', name: '기본', description: '', image: null, folderId: null}], folders: [], selectedId: 'default'};

export function restorePersonas(raw: string | undefined): PersonaCollection {
  const defaults = () => ({...defaultPersonas, items: defaultPersonas.items.map(item => ({...item})), folders: []});
  if (!raw) return defaults();
  try {
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || !Array.isArray(saved.items)) throw new Error('Invalid personas');
    const folderIds = new Set<string>();
    const folders: PersonaFolder[] = (Array.isArray(saved.folders) ? saved.folders : []).flatMap((entry: unknown) => {
      const result = folderSchema.safeParse(entry);
      if (!result.success || folderIds.has(result.data.id)) return [];
      folderIds.add(result.data.id); return [result.data];
    });
    const byId = new Map(folders.map(folder => [folder.id, folder]));
    for (const folder of folders) {
      const ancestors = new Set([folder.id]);
      let parent = folder.parentId;
      while (parent) {
        if (!byId.has(parent) || ancestors.has(parent)) {folder.parentId = null; break;}
        ancestors.add(parent); parent = byId.get(parent)!.parentId;
      }
    }
    const seen = new Set<string>();
    const items: Persona[] = saved.items.flatMap((entry: unknown) => {
      const result = personaSchema.safeParse(entry);
      if (!result.success || seen.has(result.data.id)) return [];
      seen.add(result.data.id);
      return [{...result.data, folderId: result.data.folderId && folderIds.has(result.data.folderId) ? result.data.folderId : null}];
    });
    const value: PersonaCollection = {items, folders, selectedId: items.some(item => item.id === saved.selectedId) ? saved.selectedId : items[0]?.id ?? null};
    if (Array.isArray(saved.order)) value.order = personaEntryOrder({...value, order: saved.order});
    return value;
  } catch {return defaults();}
}

export function searchPersonas(items: readonly Persona[], search: string) {
  const query = search.trim().toLocaleLowerCase();
  return items.filter(item => `${item.name} ${item.description}`.toLocaleLowerCase().includes(query));
}

/** Root search includes personas inside folders; folder search stays inside that folder. */
export function libraryPersonas(value: PersonaCollection, folderId: string | null, search: string) {
  const searchAll = folderId === null && search.trim().length > 0;
  return searchPersonas(value.items.filter(item => searchAll || item.folderId === folderId), search);
}

/** Remove stale/duplicate keys and append new entries without disturbing saved positions. */
export function personaEntryOrder(value: PersonaCollection): string[] {
  const remaining = new Set([...value.folders.map(item => `folder:${item.id}`), ...value.items.map(item => `persona:${item.id}`)]);
  const order = (value.order ?? []).filter(key => remaining.delete(key));
  return [...order, ...remaining];
}

export const personaFolderPath = folderPath;
export const nextPersonaFolderName = nextFolderName;
export const canMovePersonaFolders = canMoveFolders;
function requireFolder(value: PersonaCollection, folderId: string | null) {
  if (folderId !== null && !value.folders.some(folder => folder.id === folderId)) throw new Error('폴더를 찾을 수 없어요.');
}

/** Serialized mutations merge against the latest saved collection, including edits made while closing. */
export class PersonaPreferences {
  private state = {value: restorePersonas(undefined), ready: false, error: ''};
  private listeners = new Set<() => void>();
  private loading: Promise<void> | undefined;
  private saving: Promise<void> = Promise.resolve();
  constructor(private readonly storage: SettingsStore) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  private emit() {for (const listener of this.listeners) listener();}
  load = () => this.loading ??= this.storage.getSetting(personaSettingsKey).then(raw => {
    this.state = {value: restorePersonas(raw), ready: true, error: ''}; this.emit();
  }).catch(() => {
    this.loading = undefined;
    this.state = {...this.state, error: '페르소나를 불러오지 못했어요. 다시 시도해 주세요.'}; this.emit();
  });
  private mutate(change: (value: PersonaCollection) => PersonaCollection): Promise<void> {
    const next = this.saving.catch(() => {}).then(async () => {
      await this.load();
      if (!this.state.ready) throw new Error(this.state.error);
      const changed = change(this.state.value);
      const value = changed.order ? {...changed, order: personaEntryOrder(changed)} : changed;
      await this.storage.setSetting(personaSettingsKey, JSON.stringify({version: 1, ...value}));
      this.state = {value, ready: true, error: ''}; this.emit();
    });
    this.saving = next;
    return next;
  }
  create = async (input: PersonaFields, folderId: string | null = null): Promise<Persona> => {
    const item = {...fields.parse(input), id: newId('persona'), folderId};
    await this.mutate(value => {
      requireFolder(value, folderId);
      return {...value, items: [...value.items, item]};
    });
    return item;
  };
  select = (id: string) => this.mutate(value => {
    if (!value.items.some(item => item.id === id)) throw new Error('페르소나를 찾을 수 없어요.');
    return {...value, selectedId: id};
  });
  update = (id: string, patch: Partial<PersonaFields>) => {
    const changes = fields.partial().parse(patch);
    return this.mutate(value => {
      if (!value.items.some(item => item.id === id)) throw new Error('페르소나를 찾을 수 없어요.');
      return {...value, items: value.items.map(item => item.id === id ? personaSchema.parse({...item, ...changes}) : item)};
    });
  };
  duplicate = async (id: string): Promise<Persona> => {
    let copy: Persona | undefined;
    await this.mutate(value => {
      const original = value.items.find(item => item.id === id);
      if (!original) throw new Error('페르소나를 찾을 수 없어요.');
      copy = {...original, id: newId('persona'), name: `${original.name.slice(0, 36)} 사본`};
      return {...value, items: [...value.items, copy]};
    });
    return copy!;
  };
  remove = (id: string) => this.removeMany([id]);
  /** Delete the selected entries together; unselected folder contents return to the library. */
  removeMany = (ids: readonly string[], folderIds: readonly string[] = []) => this.mutate(value => {
    const next = removeFolderEntries(value, ids, folderIds);
    return {...next, selectedId: value.selectedId && ids.includes(value.selectedId) ? next.items[0]?.id ?? null : value.selectedId};
  });
  move = (ids: readonly string[], folderId: string | null, folderIds: readonly string[] = []) => this.mutate(value => moveFolderEntries(value, ids, folderIds, folderId));
  createFolder = async (name: string, ids: readonly string[] = [], parentId: string | null = null, folderIds: readonly string[] = []): Promise<PersonaFolder> => {
    const folder = folderSchema.parse({id: newId('persona-folder'), name, parentId});
    await this.mutate(value => addFolder(value, folder, ids, folderIds));
    return folder;
  };
  renameFolder = (folderId: string, name: string) => this.mutate(value => renameTreeFolder(value, folderId, name));
  /** Removing a folder returns its contents to the library, without deleting personas. */
  removeFolder = (folderId: string) => this.removeMany([], [folderId]);
}
