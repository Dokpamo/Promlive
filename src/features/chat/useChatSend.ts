import {useEffect, useRef, useState} from 'react';
import type {Workspace} from '../../app/workspace';
import type {useComposerDraft} from './useComposerDraft';

export function useChatSend(workspace: Workspace, draft: ReturnType<typeof useComposerDraft>, refreshMessages: () => Promise<void>) {
  const {repo, provider, creation} = workspace.runtime;
  const conversation = workspace.conversation;
  const card = workspace.cards.find(item => item.id === conversation?.cardId);
  const request = useRef<symbol | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    request.current = null;
    setSending(false);
    return () => {request.current = null;};
  }, [conversation?.id]);

  const send = async () => {
    const captured = draft.capture();
    if (!conversation || !card || !captured?.text.trim() || request.current || creation.live(conversation.id)) return;
    const token = Symbol('send');
    request.current = token;
    setSending(true);
    const accepted = () => {
      captured.accepted();
      // The first-message title should update as soon as it is saved, even during streaming.
      void workspace.refresh().catch(error => workspace.report(error));
    };
    try {
      if (provider.connected) await creation.send(card, conversation.id, captured.text, undefined, accepted);
      else {
        await repo.appendLocalUserMessage(conversation.id, captured.text);
        accepted();
        workspace.inform('AI 연결 전이에요. 메시지는 이 기기에만 저장했어요.');
      }
      await refreshMessages();
      await workspace.refresh();
    } catch (error) {
      workspace.report(error);
    } finally {
      if (request.current === token) {
        request.current = null;
        setSending(false);
      }
    }
  };
  return {send, sending};
}
