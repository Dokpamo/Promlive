import {expect, it, vi} from 'vitest';
import {repository} from './helpers';
import {PersonaPreferences, personaSettingsKey, restorePersonas, searchPersonas} from '../src/features/personas/personaPreferences';

const image = 'data:image/png;base64,cGhvdG8=';
const input = {name: '여행자', description: '새로운 세계를 탐험해요.', image};

it('persists multiple personas, selection and edits independently of the account profile', async () => {
  const repo = await repository();
  try {
    await repo.setSetting('user:profile:v1', JSON.stringify({name: '사용자', image: null}));
    const personas = new PersonaPreferences(repo);
    await personas.load();
    const traveler = await personas.create(input);
    const writer = await personas.create({...input, name: '작가'});
    await personas.select(traveler.id);
    await personas.update(traveler.id, {description: '변경한 소개'});
    const reopened = new PersonaPreferences(repo); await reopened.load();
    expect(reopened.snapshot().value).toEqual({selectedId: traveler.id, items: [
      {id: 'default', name: '기본', description: '', image: null}, {...traveler, description: '변경한 소개'}, writer,
    ]});
    expect(JSON.parse((await repo.getSetting('user:profile:v1'))!)).toEqual({name: '사용자', image: null});
  } finally {await repo.db.close();}
});

it('serializes creation, selection and rapid field changes without losing other fields', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  const storage = {getSetting: async () => {await gate; return undefined;}, setSetting: vi.fn().mockResolvedValue(undefined)};
  const personas = new PersonaPreferences(storage);
  const first = personas.create(input);
  const second = personas.create({...input, name: '탐정'});
  release();
  const [a, b] = await Promise.all([first, second]);
  await Promise.all([personas.select(a.id), personas.update(a.id, {name: '새 이름'}), personas.update(a.id, {image: null}), personas.select(b.id)]);
  expect(personas.snapshot().value.selectedId).toBe(b.id);
  expect(personas.snapshot().value.items.find(item => item.id === a.id)).toEqual({...a, name: '새 이름', image: null});
});

it('keeps the saved selection on write failure and allows a later retry', async () => {
  const storage = {getSetting: async () => undefined, setSetting: vi.fn().mockResolvedValue(undefined)};
  const personas = new PersonaPreferences(storage);
  const item = await personas.create(input);
  storage.setSetting.mockRejectedValueOnce(new Error('disk full'));
  await expect(personas.select('default')).rejects.toThrow('disk full');
  expect(personas.snapshot().value.selectedId).toBe(item.id);
  await personas.select('default');
  expect(personas.snapshot().value.selectedId).toBe('default');
});

it('duplicates independently and removes the selected persona with a valid fallback', async () => {
  let saved: string | undefined;
  const storage = {getSetting: async () => saved, setSetting: async (_: string, value: string) => {saved = value;}};
  const personas = new PersonaPreferences(storage);
  const original = await personas.create(input);
  const copy = await personas.duplicate(original.id);
  await personas.update(copy.id, {name: '복제 편집'});
  expect(personas.snapshot().value.items.find(item => item.id === original.id)?.name).toBe(input.name);
  await personas.remove(original.id);
  expect(personas.snapshot().value.selectedId).toBe('default');
  await personas.remove('default'); await personas.remove(copy.id);
  const reopened = new PersonaPreferences(storage); await reopened.load();
  expect(reopened.snapshot().value).toEqual({items: [], selectedId: null});
});

it('rejects empty names and never recreates a deleted persona from a delayed edit', async () => {
  const personas = new PersonaPreferences({getSetting: async () => undefined, setSetting: async () => {}});
  const item = await personas.create(input);
  await expect(personas.create({...input, name: '  '})).rejects.toThrow();
  const removed = personas.remove(item.id);
  const updated = personas.update(item.id, {name: '늦은 변경'});
  await removed; await expect(updated).rejects.toThrow('페르소나를 찾을 수 없어요.');
  expect(personas.snapshot().value.items).toHaveLength(1);
});

it('searches names and descriptions without changing the persisted order or selection', () => {
  const items = [{...input, id: 'one'}, {...input, id: 'two', name: 'Writer', description: '조용한 작가'}];
  expect(searchPersonas(items, ' writer ').map(item => item.id)).toEqual(['two']);
  expect(searchPersonas(items, '세계').map(item => item.id)).toEqual(['one']);
  expect(searchPersonas(items, '')).toEqual(items);
  expect(searchPersonas(items, '없는 항목')).toEqual([]);
});

it('recovers invalid selections and skips invalid or duplicate entries', () => {
  const valid = {...input, id: 'one'};
  const restored = restorePersonas(JSON.stringify({version: 1, selectedId: 'gone', items: [valid, valid, {...valid, id: 'invalid', name: ''}]}));
  expect(restored).toEqual({items: [valid], selectedId: 'one'});
  expect(restorePersonas('{').selectedId).toBe('default');
  expect(personaSettingsKey).not.toBe('user:profile:v1');
});
