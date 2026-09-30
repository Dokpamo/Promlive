import {NativeModules} from 'react-native';
import type {ScreenStorage} from './screenPersistence';

type NativeScreenMemory = {readSync(backup: boolean): string; read(): Promise<string>; write(value: string): Promise<void>};
export function createScreenStorage(): ScreenStorage {
  const native = NativeModules.PromliveScreenMemory as NativeScreenMemory | undefined;
  const module = () => {if (!native) throw new Error('Screen memory native module is unavailable'); return native;};
  return {readSync: () => module().readSync(false) || null, readBackupSync: () => module().readSync(true) || null,
    read: async () => await module().read() || null, write: value => module().write(value)};
}
