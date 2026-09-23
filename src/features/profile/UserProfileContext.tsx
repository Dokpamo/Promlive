import {createContext, useContext, useEffect, useSyncExternalStore, type ReactNode} from 'react';
import {defaultUserProfile, type UserProfilePreferences} from './userProfile';

const UserProfileContext = createContext<UserProfilePreferences | null>(null);
const fallback = {value: defaultUserProfile, ready: false, error: ''};
const fallbackSnapshot = () => fallback;
const fallbackSubscribe = () => () => {};

export function UserProfileProvider({store, children}: {store: UserProfilePreferences; children: ReactNode}) {
  useEffect(() => {void store.load();}, [store]);
  return <UserProfileContext.Provider value={store}>{children}</UserProfileContext.Provider>;
}

export function useUserProfile() {
  const store = useContext(UserProfileContext);
  const state = useSyncExternalStore(store?.subscribe ?? fallbackSubscribe, store?.snapshot ?? fallbackSnapshot);
  return {...state, store};
}
