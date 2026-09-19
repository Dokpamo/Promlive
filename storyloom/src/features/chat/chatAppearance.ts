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

export const chatColors = {
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
