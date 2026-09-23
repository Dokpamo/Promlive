import {expect, it, vi} from 'vitest';
import {repository} from './helpers';
import {defaultUserProfile, restoreUserProfile, UserProfilePreferences, userProfileKey} from '../src/features/profile/userProfile';

const image = 'data:image/png;base64,aW1hZ2U=';

it('restores the shared name and copied photo after reopening, then persists reverting the photo', async () => {
  const repo = await repository();
  try {
    const first = new UserProfilePreferences(repo);
    await first.load();
    await first.save({name: '  나의 이름  ', image});
    const reopened = new UserProfilePreferences(repo);
    await reopened.load();
    expect(reopened.snapshot().value).toEqual({name: '나의 이름', image});
    await reopened.save({...reopened.snapshot().value, image: null});
    expect(restoreUserProfile(await repo.getSetting(userProfileKey))).toEqual({name: '나의 이름', image: null});
  } finally {await repo.db.close();}
});

it('keeps the last saved profile on a failed write and allows the next save to succeed', async () => {
  const store = {getSetting: async () => JSON.stringify({name: '원래 이름', image}), setSetting: vi.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined)};
  const profile = new UserProfilePreferences(store);
  await profile.load();
  await expect(profile.save({name: '새 이름', image: null})).rejects.toThrow('disk full');
  expect(profile.snapshot().value).toEqual({name: '원래 이름', image});
  await profile.save({name: '새 이름', image: null});
  expect(profile.snapshot().value).toEqual({name: '새 이름', image: null});
});

it('waits for restoration and writes rapid changes in order', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  const store = {getSetting: async () => {await gate; return JSON.stringify({name: '저장된 이름', image});}, setSetting: vi.fn().mockResolvedValue(undefined)};
  const profile = new UserProfilePreferences(store);
  const first = profile.save({name: '첫 이름', image});
  const last = profile.save({name: '마지막 이름', image: null});
  expect(store.setSetting).not.toHaveBeenCalled();
  release(); await Promise.all([first, last]);
  expect(store.setSetting.mock.calls.map(call => JSON.parse(call[1]).name)).toEqual(['첫 이름', '마지막 이름']);
  expect(profile.snapshot().value).toEqual({name: '마지막 이름', image: null});
});

it('keeps a valid name when an old, remote or damaged image cannot be restored', () => {
  expect(restoreUserProfile('{')).toEqual(defaultUserProfile);
  expect(restoreUserProfile(JSON.stringify({name: '이름', image: 'https://example.com/private.png'}))).toEqual({name: '이름', image: null});
});

it('merges photo and name changes in write order instead of copying stale fields', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  const store = {getSetting: async () => JSON.stringify({name: '원래 이름', image: null}), setSetting: vi.fn(async () => {await gate;})};
  const profile = new UserProfilePreferences(store);
  await profile.load();
  const photo = profile.update({image});
  const name = profile.update({name: '새 이름'});
  release(); await Promise.all([photo, name]);
  expect(profile.snapshot().value).toEqual({name: '새 이름', image});
  expect(store.setSetting.mock.calls).toHaveLength(2);
});
