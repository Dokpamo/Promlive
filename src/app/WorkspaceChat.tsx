import {useSyncExternalStore, type ReactNode} from 'react';
import {View} from 'react-native';
import type {Workspace} from './workspace';
import {ChatScreen} from '../features/chat/ChatScreen';

/** Compose app-owned services without giving the chat screen access to the workspace. */
export function WorkspaceChat({workspace: w, width, header}: {workspace: Workspace; width: number; header?: ReactNode}) {
  useSyncExternalStore(w.subscribe, w.snapshot);
  useSyncExternalStore(w.history.subscribe, w.history.snapshot);
  const conversation = w.history.selected;
  const card = w.cards.find(item => item.id === conversation?.cardId);
  if (!conversation || !card) return <View style={{flex: 1}}>{header}</View>;
  return <ChatScreen key={conversation.id} session={w.chats.get(conversation.id, card)} repo={w.runtime.repo} creation={w.runtime.creation}
    {...(w.runtime.extensions ? {extensions: w.runtime.extensions} : {})} width={width} header={header}
    report={w.notifications.report} inform={w.notifications.inform}/>;
}
