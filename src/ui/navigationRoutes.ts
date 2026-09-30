export const tabs = ['library', 'chats', 'create', 'settings'] as const;
export type Tab = typeof tabs[number];
export const tabLabels: Record<Tab, string> = {library: '서재', chats: '채팅', create: '생성', settings: '설정'};
