import {NativeModules} from 'react-native';
import {SerialDatabase, type SqlResult, type SqlValue} from '../../ports/storage';
interface NativeSqlite { execute(sql: string, params: readonly SqlValue[]): Promise<SqlResult>; close(): Promise<void> }
export async function openDatabase() {
  const native = NativeModules.StoryloomSqlite as NativeSqlite | undefined;
  if (!native) throw new Error('Windows SQLite 모듈을 불러오지 못했습니다. 네이티브 앱을 다시 빌드해 주세요.');
  return new SerialDatabase({execute: (sql, params = []) => native.execute(sql, params), close: () => native.close()});
}
