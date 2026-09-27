import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import type {AuthoringStore} from '../authoring/store';

const Context = createContext<Pick<AuthoringStore, 'getAsset'> | undefined>(undefined);
export function CardAssetsProvider({store, children}: {store: Pick<AuthoringStore, 'getAsset'> | undefined; children: ReactNode}) {return <Context.Provider value={store}>{children}</Context.Provider>;}
export function useCardImage(id?: string) {
  const store = useContext(Context);
  const [result, setResult] = useState<{id: string; uri: string} | null>(null);
  useEffect(() => {
    let active = true;
    if (id && store) void store.getAsset(id).then(asset => {if (active) setResult(asset ? {id, uri: asset.uri} : null);}).catch(() => {if (active) setResult(null);});
    return () => {active = false;};
  }, [id, store]);
  return result && result.id === id ? result.uri : undefined;
}
