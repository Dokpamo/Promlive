import {z} from 'zod';
import type {SettingsStore} from '../../ports/settings';
import {newId} from '../cards/model';
import {avatarImageSchema} from '../profile/userProfile';

export const personaSettingsKey = 'personas:v1';
const fields = z.object({name: z.string().trim().min(1).max(40), description: z.string().max(2000), image: avatarImageSchema.nullable()});
const personaSchema = fields.extend({id: z.string().min(1).max(100)});
export type Persona = z.infer<typeof personaSchema>;
export type PersonaFields = z.infer<typeof fields>;
export interface PersonaCollection {items: Persona[]; selectedId: string | null}
export const defaultPersonas: PersonaCollection = {items: [{id: 'default', name: '기본', description: '', image: null}], selectedId: 'default'};

export function restorePersonas(raw: string | undefined): PersonaCollection {
  if (!raw) return {items: defaultPersonas.items.map(item => ({...item})), selectedId: 'default'};
  try {
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || !Array.isArray(saved.items)) throw new Error('Invalid personas');
    const seen = new Set<string>();
    const items: Persona[] = saved.items.flatMap((entry: unknown) => {
      const result = personaSchema.safeParse(entry);
      if (!result.success || seen.has(result.data.id)) return [];
      seen.add(result.data.id); return [result.data];
    });
    return {items, selectedId: items.some(item => item.id === saved.selectedId) ? saved.selectedId : items[0]?.id ?? null};
  } catch {return {items: defaultPersonas.items.map(item => ({...item})), selectedId: 'default'};}
}

export function searchPersonas(items: readonly Persona[], search: string) {
  const query = search.trim().toLocaleLowerCase();
  return items.filter(item => `${item.name} ${item.description}`.toLocaleLowerCase().includes(query));
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
      const value = change(this.state.value);
      await this.storage.setSetting(personaSettingsKey, JSON.stringify({version: 1, ...value}));
      this.state = {value, ready: true, error: ''}; this.emit();
    });
    this.saving = next;
    return next;
  }
  create = async (input: PersonaFields): Promise<Persona> => {
    const item = {...fields.parse(input), id: newId('persona')};
    await this.mutate(value => ({items: [...value.items, item], selectedId: item.id}));
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
  remove = (id: string) => this.mutate(value => {
    const items = value.items.filter(item => item.id !== id);
    return {items, selectedId: value.selectedId === id ? items[0]?.id ?? null : value.selectedId};
  });
}
