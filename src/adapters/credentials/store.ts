import * as Keychain from 'react-native-keychain';
import type {CredentialStore} from '../../ports/ai';

/** iOS/macOS Keychain and Android Keystore; never part of the settings database. */
export const credentialStore: CredentialStore = {
  async get(reference) {
    const saved = await Keychain.getGenericPassword({service: reference});
    return saved ? saved.password : null;
  },
  async set(reference, secret) {
    const saved = await Keychain.setGenericPassword('api-key', secret, {
      service: reference,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
    });
    if (!saved) throw new Error('API 키를 저장하지 못했어요.');
  },
  async remove(reference) {
    await Keychain.resetGenericPassword({service: reference});
  },
};
