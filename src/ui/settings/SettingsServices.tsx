import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import {loadSettingsServices, type SettingsServices} from '../../app/settingsServices';

const Context = createContext<{services: SettingsServices | null; error: string; retry: () => void}>({services: null, error: '', retry: () => {}});
export function SettingsServicesProvider({children, services: provided}: {children: ReactNode; services?: SettingsServices | undefined}) {
  const [services, setServices] = useState<SettingsServices | null>(provided ?? null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    void (provided ? provided.load().then(() => provided) : loadSettingsServices()).then(value => {
      if (current) {setServices(value); setError('');}
    }).catch(() => {if (current) setError('설정 저장소를 열지 못했어요. 다시 시도해 주세요.');});
    return () => {current = false;};
  }, [provided, attempt]);
  return <Context.Provider value={{services, error, retry: () => setAttempt(value => value + 1)}}>{children}</Context.Provider>;
}
export const useSettingsServices = () => useContext(Context);
