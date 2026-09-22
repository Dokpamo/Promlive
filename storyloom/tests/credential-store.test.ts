import 'fake-indexeddb/auto';
import {expect, it} from 'vitest';
import {BrowserCredentialStore} from '../src/adapters/credentials/store.web';

it('persists separately encrypted keys across store instances and deletes only the chosen key', async () => {
  const database = `credentials-${crypto.randomUUID()}`;
  const first = new BrowserCredentialStore(database);
  const second = new BrowserCredentialStore(database);
  await Promise.all([first.set('xai-api', 'first-local-test-key'), second.set('minimax-api', 'other-local-test-key')]);
  const reopened = new BrowserCredentialStore(database);
  expect(await reopened.get('xai-api')).toBe('first-local-test-key');
  expect(await reopened.get('minimax-api')).toBe('other-local-test-key');
  await reopened.set('xai-api', 'updated-local-test-key');
  expect(await first.get('xai-api')).toBe('updated-local-test-key');

  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(database);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const saved = await new Promise<{iv: Uint8Array; ciphertext: ArrayBuffer}>((resolve, reject) => {
    const request = db.transaction('secrets').objectStore('secrets').get('xai-api');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const key = await new Promise<CryptoKey>((resolve, reject) => {
    const request = db.transaction('keys').objectStore('keys').get('master');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  expect(key.extractable).toBe(false);
  expect(new TextDecoder().decode(saved.ciphertext)).not.toContain('updated-local-test-key');
  db.close();
  await reopened.remove('xai-api');
  expect(await first.get('xai-api')).toBeNull();
  expect(await first.get('minimax-api')).toBe('other-local-test-key');
});
