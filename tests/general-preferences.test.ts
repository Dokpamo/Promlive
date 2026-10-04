import {expect, it, vi} from 'vitest';
import {GeneralPreferences} from '../src/features/settings/generalPreferences';
import {Repository} from '../src/adapters/sqlite/repository';
import {migrate} from '../src/adapters/sqlite/migrations';
import {nodeDatabase} from './helpers';

it('writes only changed fields and skips unchanged edits, including queued duplicates', async () => {
  const setSetting = vi.fn(async () => {});
  const preferences = new GeneralPreferences({getSetting: async () => undefined, setSetting});
  await preferences.load();
  preferences.update({prompt: 'one'}); preferences.update({prompt: 'one'});
  preferences.update({prompt: 'two'}); preferences.update({theme: 'dark'});
  await preferences.flush();
  expect(setSetting.mock.calls).toEqual([['ui:prompt:v1', 'one'], ['ui:prompt:v1', 'two'], ['appearance:theme', 'dark']]);
  preferences.update({}); preferences.update({theme: 'dark'}); await preferences.flush();
  expect(setSetting).toHaveBeenCalledTimes(3);
});

it('retries only the failed part of a multi-field write and keeps the newest edits', async () => {
  let failed = true;
  const values = new Map<string, string>();
  const setSetting = vi.fn(async (key: string, value: string) => {
    if (key === 'ui:prompt:v1' && failed) throw new Error('disk full');
    values.set(key, value);
  });
  const preferences = new GeneralPreferences({getSetting: async key => values.get(key), setSetting});
  await preferences.load();
  preferences.update({theme: 'dark', prompt: 'first'}); await preferences.flush();
  expect(preferences.snapshot().error).not.toBe('');
  failed = false;
  preferences.update({}); preferences.update({prompt: 'latest'}); await preferences.flush();
  expect(values.get('ui:prompt:v1')).toBe('latest');
  expect(setSetting.mock.calls.filter(([key]) => key === 'appearance:theme')).toHaveLength(1);
  expect(preferences.snapshot().error).toBe('');
});

it('does not let an older completion drop an edit made while saving', async () => {
  let finish!: () => void;
  const gate = new Promise<void>(resolve => {finish = resolve;});
  const values = new Map<string, string>();
  const preferences = new GeneralPreferences({getSetting: async key => values.get(key), setSetting: async (key, value) => {
    if (value === 'first') await gate;
    values.set(key, value);
  }});
  await preferences.load();
  preferences.update({prompt: 'first'}); await Promise.resolve();
  preferences.update({prompt: 'last'}); finish(); await preferences.flush();
  expect(values.get('ui:prompt:v1')).toBe('last');
  expect(preferences.snapshot().prompt).toBe('last');
});

it('keeps edits made during initial loading without overwriting unedited stored values', async () => {
  let finish!: () => void;
  const gate = new Promise<void>(resolve => {finish = resolve;});
  const setSetting = vi.fn(async () => {});
  const preferences = new GeneralPreferences({getSetting: async key => {await gate; return key === 'appearance:theme' ? 'dark' : undefined;}, setSetting});
  const loading = preferences.load(); preferences.update({prompt: 'typed early'});
  finish(); await loading; await preferences.flush();
  expect(preferences.snapshot()).toMatchObject({theme: 'dark', prompt: 'typed early'});
  expect(setSetting.mock.calls).toEqual([['ui:prompt:v1', 'typed early']]);
});

it('persists a multi-field edit once through the repository transaction', async () => {
  const db = await nodeDatabase(); await migrate(db);
  const repo = new Repository(db), preferences = new GeneralPreferences(repo);
  await preferences.load();
  const transaction = vi.spyOn(db, 'transaction');
  preferences.update({theme: 'dark', prompt: 'saved together'}); await preferences.flush();
  expect(transaction).toHaveBeenCalledTimes(1);
  const reopened = new GeneralPreferences(repo); await reopened.load();
  expect(reopened.snapshot()).toMatchObject({theme: 'dark', prompt: 'saved together'});
  await db.close();
});

it('retries edits after an initial read failure without replacing other saved fields', async () => {
  let failed = true;
  const values = new Map([['appearance:theme', 'dark']]);
  const preferences = new GeneralPreferences({getSetting: async key => {
    if (failed) throw new Error('temporarily unavailable');
    return values.get(key);
  }, setSetting: async (key, value) => {values.set(key, value);}});
  preferences.update({prompt: 'keep this edit'}); await preferences.flush();
  expect(preferences.snapshot().error).not.toBe('');
  failed = false; preferences.update({}); await preferences.flush();
  expect(values.get('ui:prompt:v1')).toBe('keep this edit');
  expect(values.get('appearance:theme')).toBe('dark');
  expect(preferences.snapshot()).toMatchObject({prompt: 'keep this edit', theme: 'dark', error: ''});
});
