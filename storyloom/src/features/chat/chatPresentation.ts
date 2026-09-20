export type ChatDisplayMode = 'default' | 'chat' | 'story';

export const chatDisplaySettingKey = 'appearance:chat-display';
export const chatDisplayModes = ['default', 'chat', 'story'] as const;
export const chatDisplayLabels: Record<ChatDisplayMode, string> = {default: '기본', chat: '채팅', story: '스토리'};
export const chatDisplayDescriptions: Record<ChatDisplayMode, string> = {
  default: '내 메시지는 말풍선, AI 답변은 본문으로',
  chat: '나와 AI 모두 말풍선으로',
  story: '나와 AI 모두 배경 위의 본문으로',
};

export function storedChatDisplay(value: string | undefined): ChatDisplayMode {
  return value === 'chat' || value === 'story' ? value : 'default';
}
