import type {ChatMessage, Conversation} from '../features/workspace/model';

/** Local sample dialogue. Sending never invents an AI response. */
export function previewConversation(id: string, lastMessage: string, at: number): Conversation {
  const lines: {role: ChatMessage['role']; text: string}[] = id === 'night-library' ? [
    {role: 'assistant', text: '어서 와. 비가 많이 오지?\n여기, 창가 자리가 비어 있어.'},
    {role: 'user', text: '이 시간에도 문을 여는 도서관이 있네.'},
    {role: 'assistant', text: '돌아갈 곳이 필요한 밤에는\n조금 더 오래 열어 두거든.'},
    {role: 'assistant', text: '따뜻한 차 한 잔 줄까?'},
    {role: 'user', text: '응, 좋아.'},
    {role: 'user', text: '오늘은 좀 오래 머물러도 될까?'},
    {role: 'assistant', text: '물론이지. 여기서는 서두르지 않아도 돼.\n네 이야기를 천천히 들려줘.'},
    {role: 'assistant', text: lastMessage},
  ] : [{role: 'assistant', text: lastMessage}];
  return {draft: '', draftImage: null, messages: lines.map((line, index) => ({...line, id: `${id}-sample-${index}`, sentAt: at - (lines.length - index - 1) * 60_000}))};
}

export function groupedMessage(messages: ChatMessage[], index: number) {
  const current = messages[index]!;
  const connected = (other: ChatMessage | undefined) => !!other && other.role === current.role && Math.abs(other.sentAt - current.sentAt) < 5 * 60_000;
  return {before: connected(messages[index - 1]), after: connected(messages[index + 1])};
}
