import {useEffect, useSyncExternalStore} from 'react';
import {composerAction, type ChatSession} from './ChatSession';

export function useChatSession(session: ChatSession) {
  const state = useSyncExternalStore(session.subscribe, session.snapshot);
  useEffect(() => {void session.load(); return () => {void session.flush().catch(() => undefined);};}, [session]);
  return {...state, action: composerAction(state), change: session.change, send: session.send, cancel: session.cancel};
}
