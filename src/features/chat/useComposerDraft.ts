import {useEffect, useRef, useState} from 'react';
import type {StoryRepository} from '../../ports/repository';

interface DraftSession {
  id: string;
  value: string;
  revision: number;
  ready: boolean;
  active: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

export function useComposerDraft(repo: StoryRepository, conversationId: string | undefined, onError: (error: unknown) => void) {
  const session = useRef<DraftSession | null>(null);
  const [state, setState] = useState({id: conversationId, value: '', ready: false});

  useEffect(() => {
    if (!conversationId) return;
    const current: DraftSession = {id: conversationId, value: '', revision: 0, ready: false, active: true};
    session.current = current;
    setState({id: conversationId, value: '', ready: false});
    void repo.getSetting(`composer:${current.id}`).then(value => {
      if (!current.active) return;
      current.value = value ?? '';
      current.ready = true;
      setState({id: current.id, value: current.value, ready: true});
    }).catch(onError);
    return () => {
      current.active = false;
      clearTimeout(current.timer);
      if (current.ready) void repo.saveComposerDraft(current.id, current.value).catch(onError);
    };
  }, [repo, conversationId, onError]);

  const change = (value: string) => {
    const current = session.current;
    if (!current?.active || !current.ready || current.id !== conversationId) return;
    current.value = value;
    current.revision++;
    setState({id: current.id, value, ready: true});
    clearTimeout(current.timer);
    current.timer = setTimeout(() => {
      void repo.saveComposerDraft(current.id, current.value).catch(onError);
    }, 300);
  };

  const capture = () => {
    const current = session.current;
    if (!current?.active || !current.ready || current.id !== conversationId) return null;
    const revision = current.revision;
    return {
      text: current.value,
      accepted: () => {
        // Only clear the exact draft that was sent, never text edited while saving.
        if (!current.active || session.current !== current || current.revision !== revision) return;
        clearTimeout(current.timer);
        current.value = '';
        current.revision++;
        setState({id: current.id, value: '', ready: true});
        void repo.saveComposerDraft(current.id, '').catch(onError);
      },
    };
  };

  return {
    value: state.id === conversationId ? state.value : '',
    ready: state.id === conversationId && state.ready,
    change,
    capture,
  };
}
