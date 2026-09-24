import {expect, it, vi} from 'vitest';
import {repository} from './helpers';
import {PersonaPreferences, personaSettingsKey, restorePersonas, searchPersonas, libraryPersonas, nextPersonaFolderName, personaEntryOrder} from '../src/features/personas/personaPreferences';

const image = 'data:image/png;base64,cGhvdG8=';
const input = {name: '여행자', description: '새로운 세계를 탐험해요.', image};

it('preserves previously saved ordering when the gesture UI is removed', async () => {
  let saved = JSON.stringify({version: 1, folders: [{id: 'f', name: '보관'}], items: [{...input, id: 'a'}, {...input, id: 'b'}],
    selectedId: 'a', order: ['persona:b', 'folder:f', 'persona:a', 'persona:gone', 'persona:a']});
  const storage = {getSetting: async () => saved, setSetting: async (_: string, value: string) => {saved = value;}};
  const store = new PersonaPreferences(storage); await store.load();
  await store.update('a', {name: '이름 수정'});
  await store.move(['a'], 'f');
  const reopened = new PersonaPreferences(storage); await reopened.load();
  expect(personaEntryOrder(reopened.snapshot().value)).toEqual(['persona:b', 'folder:f', 'persona:a']);
  await reopened.remove('b');
  expect(reopened.snapshot().value.order).toEqual(['folder:f', 'persona:a']);
});

it('moves folders and selected personas atomically without flattening selected descendants', async () => {
  let saved: string | undefined;
  const store = new PersonaPreferences({getSetting: async () => saved, setSetting: async (_, value) => {saved = value;}});
  const parent = await store.createFolder('상위'), child = await store.createFolder('하위', [], parent.id), destination = await store.createFolder('목적지');
  const nested = await store.create(input, child.id), independent = await store.create(input);
  await store.move([nested.id, independent.id], destination.id, [parent.id, child.id]);
  const value = restorePersonas(saved);
  expect(value.folders.find(item => item.id === parent.id)?.parentId).toBe(destination.id);
  expect(value.folders.find(item => item.id === child.id)?.parentId).toBe(parent.id);
  expect(value.items.find(item => item.id === nested.id)?.folderId).toBe(child.id);
  expect(value.items.find(item => item.id === independent.id)?.folderId).toBe(destination.id);
  await store.move([], null, [parent.id]);
  expect(store.snapshot().value.folders.find(item => item.id === parent.id)?.parentId).toBeNull();
});

it('rejects folder cycles, duplicate destination names and failed writes without changing the library', async () => {
  const storage = {getSetting: async () => undefined, setSetting: vi.fn().mockResolvedValue(undefined)};
  const store = new PersonaPreferences(storage);
  const parent = await store.createFolder('보관'), child = await store.createFolder('하위', [], parent.id), destination = await store.createFolder('목적지');
  await store.createFolder('보관', [], destination.id);
  const before = store.snapshot().value;
  await expect(store.move([], child.id, [parent.id])).rejects.toThrow('자기 자신이나 하위 폴더');
  await expect(store.move([], parent.id, [parent.id])).rejects.toThrow('자기 자신이나 하위 폴더');
  await expect(store.move([], destination.id, [parent.id])).rejects.toThrow('같은 이름');
  await expect(store.createFolder('새폴더 1', [], child.id, [parent.id])).rejects.toThrow('자기 자신이나 하위 폴더');
  storage.setSetting.mockRejectedValueOnce(new Error('disk full'));
  await expect(store.move([], destination.id, [child.id])).rejects.toThrow('disk full');
  expect(store.snapshot().value).toBe(before);
  await store.move([], destination.id, [child.id]);
  expect(store.snapshot().value.folders.find(item => item.id === child.id)?.parentId).toBe(destination.id);
});

it('creates a folder and files mixed selections in the same saved mutation', async () => {
  const store = new PersonaPreferences({getSetting: async () => undefined, setSetting: async () => {}});
  const existing = await store.createFolder('기존'), persona = await store.create(input);
  const folder = await store.createFolder('새폴더 1', [persona.id], null, [existing.id]);
  expect(store.snapshot().value.folders.find(item => item.id === existing.id)?.parentId).toBe(folder.id);
  expect(store.snapshot().value.items.find(item => item.id === persona.id)?.folderId).toBe(folder.id);
});

it.each([
  {names: [], expected: '새폴더 1'},
  {names: ['새폴더 1'], expected: '새폴더 2'},
  {names: ['새폴더 2', '여행'], expected: '새폴더 1'},
  {names: ['새폴더 3', '새폴더 1'], expected: '새폴더 2'},
  {names: ['새폴더 2', '새폴더 1', '새폴더 3'], expected: '새폴더 4'},
])('suggests the first unused folder number: $names → $expected', ({names, expected}) => {
  expect(nextPersonaFolderName(names.map((name, index) => ({id: String(index), name})))).toBe(expected);
});

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
    expect(reopened.snapshot().value).toEqual({folders: [], selectedId: traveler.id, items: [
      {id: 'default', name: '기본', description: '', image: null, folderId: null}, {...traveler, description: '변경한 소개'}, writer,
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
  await personas.select(item.id);
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
  expect(reopened.snapshot().value).toEqual({items: [], folders: [], selectedId: null});
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
  const items = [{...input, id: 'one', folderId: null}, {...input, id: 'two', folderId: null, name: 'Writer', description: '조용한 작가'}];
  expect(searchPersonas(items, ' writer ').map(item => item.id)).toEqual(['two']);
  expect(searchPersonas(items, '세계').map(item => item.id)).toEqual(['one']);
  expect(searchPersonas(items, '')).toEqual(items);
  expect(searchPersonas(items, '없는 항목')).toEqual([]);
});

it('recovers invalid selections and skips invalid or duplicate entries', () => {
  const valid = {...input, id: 'one'};
  const restored = restorePersonas(JSON.stringify({version: 1, selectedId: 'gone', items: [valid, valid, {...valid, id: 'invalid', name: ''}]}));
  expect(restored).toEqual({items: [{...valid, folderId: null}], folders: [], selectedId: 'one'});
  expect(restorePersonas('{').selectedId).toBe('default');
  expect(personaSettingsKey).not.toBe('user:profile:v1');
});

it('creates and edits library entries without choosing a different persona', async () => {
  const personas = new PersonaPreferences({getSetting: async () => undefined, setSetting: async () => {}});
  const item = await personas.create(input);
  await personas.update(item.id, {name: '편집한 이름'});
  expect(personas.snapshot().value.selectedId).toBe('default');
});

it('persists folders, bulk moves and creation inside a folder across restart', async () => {
  let saved: string | undefined;
  const storage = {getSetting: async () => saved, setSetting: async (_: string, value: string) => {saved = value;}};
  const personas = new PersonaPreferences(storage);
  const a = await personas.create(input), b = await personas.create({...input, name: '작가'});
  const folder = await personas.createFolder('등장인물', [a.id, b.id]);
  const c = await personas.create({...input, name: '탐정'}, folder.id);
  await personas.move([a.id], null);
  await personas.renameFolder(folder.id, '이야기');
  const reopened = new PersonaPreferences(storage); await reopened.load();
  const value = reopened.snapshot().value;
  expect(value.folders).toEqual([{...folder, name: '이야기'}]);
  expect(libraryPersonas(value, null, '').map(item => item.id)).toEqual(['default', a.id]);
  expect(libraryPersonas(value, folder.id, '').map(item => item.id)).toEqual([b.id, c.id]);
  expect(libraryPersonas(value, null, '작가').map(item => item.id)).toEqual([b.id]);
  expect(libraryPersonas(value, folder.id, '여행자')).toEqual([]);
  expect(value.selectedId).toBe('default');
});

it('does not partially create a folder or move entries if saving fails', async () => {
  const storage = {getSetting: async () => undefined, setSetting: vi.fn().mockResolvedValue(undefined)};
  const personas = new PersonaPreferences(storage);
  const item = await personas.create(input);
  const before = personas.snapshot().value;
  storage.setSetting.mockRejectedValueOnce(new Error('disk full'));
  await expect(personas.createFolder('폴더', [item.id])).rejects.toThrow('disk full');
  expect(personas.snapshot().value).toEqual(before);
  const folder = await personas.createFolder('폴더', [item.id]);
  storage.setSetting.mockRejectedValueOnce(new Error('disk full'));
  await expect(personas.move([item.id], null)).rejects.toThrow('disk full');
  expect(personas.snapshot().value.items.find(entry => entry.id === item.id)?.folderId).toBe(folder.id);
  await expect(personas.createFolder('폴더')).rejects.toThrow('같은 이름');
  await personas.move([item.id], null);
});

it('keeps edits when moving and deleting folders; bulk deletion only removes requested personas', async () => {
  const personas = new PersonaPreferences({getSetting: async () => undefined, setSetting: async () => {}});
  const a = await personas.create(input), b = await personas.create({...input, name: '작가'});
  const folder = await personas.createFolder('정리');
  await Promise.all([personas.move([a.id, b.id], folder.id), personas.update(a.id, {description: '수정'}), personas.renameFolder(folder.id, '보관')]);
  await personas.removeFolder(folder.id);
  expect(personas.snapshot().value.items.find(item => item.id === a.id)).toEqual({...a, description: '수정', folderId: null});
  expect(personas.snapshot().value.folders).toEqual([]);
  await expect(personas.move([a.id], folder.id)).rejects.toThrow('폴더를 찾을 수 없어요.');
  await personas.removeMany([a.id, b.id]);
  expect(personas.snapshot().value.items.map(item => item.id)).toEqual(['default']);
  await expect(personas.createFolder('삭제 후', [a.id])).rejects.toThrow('페르소나를 찾을 수 없어요.');
  expect(personas.snapshot().value.folders).toEqual([]);
});

it('restores old saves and returns dangling folder references to the root library', () => {
  const old = {...input, id: 'old'};
  const restored = restorePersonas(JSON.stringify({version: 1, selectedId: 'old', items: [old, {...old, id: 'dangling', folderId: 'missing'}, {...old, id: 'filed', folderId: 'valid'}],
    folders: [{id: 'valid', name: '보관'}, {id: 'valid', name: '중복'}, {id: 'invalid', name: ''}]}));
  expect(restored.items.map(item => item.folderId)).toEqual([null, null, 'valid']);
  expect(restored.folders).toEqual([{id: 'valid', name: '보관', parentId: null}]);
  expect(restored.selectedId).toBe('old');
});

it('deletes mixed selections atomically and preserves unselected folder contents across restart', async () => {
  let saved: string | undefined;
  const storage = {getSetting: async () => saved, setSetting: vi.fn(async (_: string, value: string) => {saved = value;})};
  const personas = new PersonaPreferences(storage);
  const a = await personas.create(input), b = await personas.create({...input, name: '작가'});
  const folder = await personas.createFolder('보관', [a.id, b.id]);
  await personas.select(b.id);
  const before = personas.snapshot().value;
  storage.setSetting.mockClear();
  storage.setSetting.mockRejectedValueOnce(new Error('disk full'));
  await expect(personas.removeMany([b.id], [folder.id])).rejects.toThrow('disk full');
  expect(personas.snapshot().value).toEqual(before);
  expect(restorePersonas(saved)).toEqual(before);
  await personas.removeMany([b.id], [folder.id]);
  expect(storage.setSetting).toHaveBeenCalledTimes(2);
  const reopened = new PersonaPreferences(storage); await reopened.load();
  expect(reopened.snapshot().value).toEqual({folders: [], selectedId: 'default', items: [
    {id: 'default', name: '기본', description: '', image: null, folderId: null}, a,
  ]});
});

it('promotes unselected contents and child folders to the nearest surviving parent when deleting nested folders', async () => {
  const personas = new PersonaPreferences({getSetting: async () => undefined, setSetting: async () => {}});
  const root = await personas.createFolder('상위'), middle = await personas.createFolder('중간', [], root.id);
  const child = await personas.createFolder('하위', [], middle.id);
  const a = await personas.create(input, middle.id), b = await personas.create(input, child.id);
  await personas.removeFolder(middle.id);
  expect(personas.snapshot().value.items.find(item => item.id === a.id)?.folderId).toBe(root.id);
  expect(personas.snapshot().value.folders.find(item => item.id === child.id)?.parentId).toBe(root.id);
  expect(personas.snapshot().value.items.find(item => item.id === b.id)?.folderId).toBe(child.id);
  await personas.removeMany([], [root.id, child.id]);
  expect(personas.snapshot().value.items.every(item => item.folderId === null)).toBe(true);
});

it('makes old folders and broken or cyclic parent references reachable from the root', () => {
  const value = restorePersonas(JSON.stringify({version: 1, items: [], folders: [
    {id: 'old', name: '이전'}, {id: 'missing', name: '끊김', parentId: 'gone'},
    {id: 'a', name: 'A', parentId: 'b'}, {id: 'b', name: 'B', parentId: 'a'},
  ]}));
  expect(value.folders.find(folder => folder.id === 'old')?.parentId).toBeNull();
  expect(value.folders.find(folder => folder.id === 'missing')?.parentId).toBeNull();
  for (const folder of value.folders) {
    const seen = new Set([folder.id]); let parent = folder.parentId;
    while (parent) {expect(seen.has(parent)).toBe(false); seen.add(parent); parent = value.folders.find(item => item.id === parent)!.parentId;}
  }
});
