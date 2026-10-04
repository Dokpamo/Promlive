import type {WorkCard, LibraryCard, ChatRow} from '../../features/workspace/model';
import {useContext, useEffect, useMemo, useSyncExternalStore} from 'react';
import type {ScreenMemoryController} from '../ScreenController';
import {BodyPageContext} from '../BodyMotion';
import type {CollectionQuery} from '../../ports/workspace';
import type {CollectionState} from './contracts';

const noSubscribe = () => () => {};
const empty: CollectionState = {rows: [], next: null, ready: false, loading: false, error: false};
export function useWorkspaceRows<T extends WorkCard | LibraryCard | ChatRow>(memory: ScreenMemoryController, query: CollectionQuery, fallback: T[]) {
  const {prepared = true} = useContext(BodyPageContext);
  const collection = useMemo(() => memory.workspace?.collection(query), [memory, query.scope, query.filter, query.search]);
  const state = useSyncExternalStore(prepared ? collection?.subscribe ?? noSubscribe : noSubscribe, collection?.snapshot ?? (() => empty));
  useEffect(() => {if (prepared) void collection?.load();}, [collection, prepared]);
  const rows = useMemo(() => !collection ? fallback : state.rows.map(row => query.scope === 'library'
    ? {...(row.value as WorkCard).published!, id: row.id, activity: (row.value as WorkCard).activity} as T : row.value as T), [collection, state.rows, fallback, query.scope]);
  return {rows, ready: !collection || state.ready || state.rows.length > 0, loading: state.loading, error: state.error,
    hasMore: !!collection && !state.error && (!state.ready || !!state.next),
    loadMore: prepared ? collection?.loadMore : undefined, refresh: collection?.refresh};
}
export function useWorkspaceRoom(memory: ScreenMemoryController, fallback: ChatRow) {
  const room = useMemo(() => memory.workspace?.room(fallback.id, fallback), [memory, fallback.id]);
  const state = useSyncExternalStore(room?.subscribe ?? noSubscribe, room?.snapshot ?? (() => null));
  return {room, state, chat: state?.chat ?? fallback};
}
