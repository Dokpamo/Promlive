import {useEffect, useMemo, useSyncExternalStore} from 'react';
import type {MessageReader} from './store';
import {MessageHistory} from './messageHistory';

export function useChatMessages(repo: MessageReader, conversationId: string | undefined, activeRequestId: string | undefined, onError: (error: unknown) => void) {
  const history = useMemo(() => new MessageHistory(repo, conversationId), [repo, conversationId]);
  const state = useSyncExternalStore(history.subscribe, history.snapshot);
  useEffect(() => {
    void history.refresh().catch(onError);
  }, [history, activeRequestId, onError]);
  return {...state, refresh: history.refresh, loadOlder: history.loadOlder};
}
