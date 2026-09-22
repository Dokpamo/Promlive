import type {CredentialStore} from '../../ports/ai';

type EncryptedSecret = {iv: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer};
const encoder = new TextEncoder();

/** Origin-local browser storage, separate from exported application data.
 * The non-extractable encryption key is local too; this is not an OS keychain.
 */
export class BrowserCredentialStore implements CredentialStore {
  constructor(private readonly database = 'promlive-credentials-v1') {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.database, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('keys');
        request.result.createObjectStore('secrets');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('API 키 저장소를 열지 못했어요.'));
    });
  }

  private request<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const request = action(tx.objectStore(store));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(new Error('API 키 저장소 작업이 중단됐어요.'));
      tx.onerror = () => reject(new Error('API 키 저장소를 사용할 수 없어요.'));
    });
  }

  private async encryptionKey(db: IDBDatabase): Promise<CryptoKey> {
    const existing = await this.request<CryptoKey | undefined>(db, 'keys', 'readonly', store => store.get('master'));
    if (existing) return existing;
    const candidate = await crypto.subtle.generateKey({name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
    // A read/write transaction keeps simultaneous initial writes from replacing the key.
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite');
      const store = tx.objectStore('keys');
      const request = store.get('master');
      let key = candidate;
      request.onsuccess = () => {
        if (request.result) key = request.result as CryptoKey;
        else store.put(candidate, 'master');
      };
      tx.oncomplete = () => resolve(key);
      tx.onabort = tx.onerror = () => reject(new Error('API 키 암호화 저장소를 준비하지 못했어요.'));
    });
  }

  async get(reference: string): Promise<string | null> {
    const db = await this.open();
    try {
      const saved = await this.request<EncryptedSecret | undefined>(db, 'secrets', 'readonly', store => store.get(reference));
      if (!saved) return null;
      const key = await this.request<CryptoKey | undefined>(db, 'keys', 'readonly', store => store.get('master'));
      if (!key) throw new Error('저장한 API 키를 열지 못했어요.');
      const plaintext = await crypto.subtle.decrypt({name: 'AES-GCM', iv: saved.iv, additionalData: encoder.encode(reference)}, key, saved.ciphertext);
      return new TextDecoder().decode(plaintext);
    } finally {db.close();}
  }

  async set(reference: string, secret: string): Promise<void> {
    const db = await this.open();
    try {
      const key = await this.encryptionKey(db);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData: encoder.encode(reference)}, key, encoder.encode(secret));
      await this.request(db, 'secrets', 'readwrite', store => store.put({iv, ciphertext}, reference));
    } finally {db.close();}
  }

  async remove(reference: string): Promise<void> {
    const db = await this.open();
    try {await this.request(db, 'secrets', 'readwrite', store => store.delete(reference));}
    finally {db.close();}
  }
}

export const credentialStore: CredentialStore = new BrowserCredentialStore();
