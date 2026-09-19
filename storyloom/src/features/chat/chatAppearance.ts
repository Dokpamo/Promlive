/** Measurements in the user's 618 × 1280 reference, before density conversion. */
export const referenceComposer = {
  viewportWidth: 618,
  inset: 20,
  bottom: 20,
  compactHeight: 111,
  firstLineHeight: 171,
  lineHeight: 37,
  maxHeight: 265,
  button: 70,
  fontSize: 27,
} as const;

export const darkChatColors = {
  background: '#111111',
  drawer: '#1F1F1F',
  drawerPreview: '#1A1A1A',
  historySelected: '#2A2A2A',
  historyPressed: '#2D2D2D',
  header: '#292929',
  headerBorder: '#414141',
  composer: '#282828',
  border: '#444444',
  button: '#303030',
  text: '#E4E4E4',
  muted: '#929292',
  placeholder: '#777777',
  send: '#D1D1D1',
  sendIcon: '#262626',
  buttonIcon: '#CDCDCD',
  icon: '#D0D0D0',
  backIcon: '#FAFAFA',
  headerPressed: '#333333',
  actionPressed: '#383838',
  brand: '#F3F3F3',
  search: '#262626',
  searchIcon: '#999999',
  title: '#EFEFEF',
  preview: '#969696',
  divider: '#303030',
  userName: '#E6E6E6',
  userAvatar: '#494137',
  userIcon: '#E1D8CC',
  settingsIcon: '#CBCBCB',
  bubble: '#2A2A2A',
  error: '#E9AAAA',
  noticeError: '#FFB9B9',
  notice: '#353535',
  noticeBorder: '#484848',
};

export type ChatColors = typeof darkChatColors;

/** Sampled from the supplied light Kimi screenshots, using the same geometry. */
export const lightChatColors: ChatColors = {
  background: '#FFFFFF', drawer: '#F5F5F5', drawerPreview: '#F9F9F9',
  historySelected: '#EEEEEE', historyPressed: '#E6E6E6',
  header: '#FFFFFF', headerBorder: '#FFFFFF', headerPressed: '#EEEEEE', actionPressed: '#EEEEEE',
  composer: '#FFFFFF', border: '#FFFFFF', button: '#F7F7F7',
  text: '#1A1A1A', muted: '#777777', placeholder: '#999999',
  send: '#252525', sendIcon: '#FFFFFF', buttonIcon: '#343434', icon: '#333333', backIcon: '#242424',
  brand: '#1A1A1A', search: '#FFFFFF', searchIcon: '#555555',
  title: '#1D1D1D', preview: '#777777', divider: '#E9E9E9',
  userName: '#262626', userAvatar: '#E8DFD2', userIcon: '#665A49', settingsIcon: '#444444',
  bubble: '#F1F1F1', error: '#B03E3E', noticeError: '#A72E2E', notice: '#F0F0F0', noticeBorder: '#E2E2E2',
};

/** Header placement in the 618px reference; navigation now uses a back arrow. */
export const referenceHeader = {
  viewportWidth: 618,
  left: 27,
  right: 11,
  top: 0,
  height: 76,
  gap: 10,
  back: 76,
  backGap: 20,
  actions: 144,
  actionInset: 8,
  action: 64,
  avatar: 68,
  avatarInset: 4,
  titleInset: 86,
  titleFont: 32,
} as const;

const avatarColors = ['#499CC4', '#8270B5', '#4B928A', '#BA8958', '#657BAE'];

export function chatAvatarColor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return avatarColors[hash % avatarColors.length];
}

export function composerScale(width: number) {
  return (width > 600 ? 412 : width) / referenceComposer.viewportWidth;
}
