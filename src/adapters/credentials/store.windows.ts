import {NativeModules} from 'react-native';
import type {CredentialStore} from '../../ports/ai';

function nativeStore(): CredentialStore {
  const store = NativeModules.PromliveCredentials as CredentialStore | undefined;
  if (!store) throw new Error('API 키 저장소를 불러오지 못했어요. 앱을 다시 빌드해 주세요.');
  return store;
}

export const credentialStore: CredentialStore = {
  get: reference => nativeStore().get(reference),
  set: (reference, secret) => nativeStore().set(reference, secret),
  remove: reference => nativeStore().remove(reference),
};
