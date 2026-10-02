import {NativeModules} from 'react-native';
import {ScreenStorageConflict, type ScreenStorage} from './screenPersistence';
import {decodeScreenSnapshot, inspectScreenSnapshot} from './screenState';

type ReadResult = {value?: string; error?: string};
type NativeScreenMemory = {readSync(backup: boolean): ReadResult; read(): Promise<ReadResult>; readViewSync(): ReadResult;
  write(value: string, expected: string, absent: boolean, backup: boolean): Promise<boolean>; writeView(value: string): Promise<void>};
export function createScreenStorage(): ScreenStorage {
  const native = NativeModules.PromliveScreenMemory as NativeScreenMemory | undefined;
  const module = () => {if (!native) throw new Error('Screen memory native module is unavailable'); return native;};
  const value = (result: ReadResult) => {
    if (!result || typeof result !== 'object') throw new Error('Screen memory native module needs an update');
    if (result.error) throw new Error(result.error); return result.value ?? null;
  };
  return {readSync: () => value(module().readSync(false)), readBackupSync: () => value(module().readSync(true)),
    read: async () => value(await module().read()), readViewSync: () => value(module().readViewSync()), writeView: raw => module().writeView(raw),
    async write(raw, expected) {
      if (!decodeScreenSnapshot(raw) || inspectScreenSnapshot(expected).kind === 'unsupported') throw new Error('Invalid screen content');
      if (!await module().write(raw, expected ?? '', expected === null, !!decodeScreenSnapshot(expected))) throw new ScreenStorageConflict();
    }};
}
