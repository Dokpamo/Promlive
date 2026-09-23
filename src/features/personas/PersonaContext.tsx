import {createContext, useContext, useEffect, useSyncExternalStore, type ReactNode} from 'react';
import {defaultPersonas, type PersonaPreferences} from './personaPreferences';

const PersonaContext = createContext<PersonaPreferences | null>(null);
const fallback = {value: defaultPersonas, ready: false, error: ''};
const snapshot = () => fallback;
const subscribe = () => () => {};

export function PersonaProvider({store, children}: {store: PersonaPreferences; children: ReactNode}) {
  useEffect(() => {void store.load();}, [store]);
  return <PersonaContext.Provider value={store}>{children}</PersonaContext.Provider>;
}

export function usePersonas() {
  const store = useContext(PersonaContext);
  const state = useSyncExternalStore(store?.subscribe ?? subscribe, store?.snapshot ?? snapshot);
  return {...state, store, selected: state.value.items.find(item => item.id === state.value.selectedId)};
}
