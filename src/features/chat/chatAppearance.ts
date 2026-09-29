import {referenceTypography} from '../../layout/metrics';

/** Message proportions from the 618px-wide conversation references. */
export const referenceMessage = {
  viewportWidth: 618,
  inset: 28,
  top: 36,
  bottom: 28,
  bubbleWidth: 487,
  bubbleInset: 22,
  bubbleVerticalInset: 14,
  bubbleRadius: 30,
  lineHeight: 44,
  paragraphGap: 28,
  messageGap: 44,
} as const;

/** Measurements in the user's 618 × 1280 reference, before density conversion. */
export const referenceComposer = {
  viewportWidth: 618,
  inset: 20,
  bottom: 20,
  compactHeight: 111,
  firstLineHeight: 171,
  lineHeight: 37,
  maxLines: 7,
  button: 70,
  fontSize: referenceTypography.titleFontSize,
} as const;

export const darkChatColors = {
  background: '#101010', drawer: '#101010', drawerPreview: '#101010',
  historySelected: '#202020', historyPressed: '#2D2D2D',
  header: '#101010', headerBorder: '#303030', headerPressed: '#202020', actionPressed: '#2D2D2D',
  composer: '#202020', border: '#303030', button: '#202020',
  text: '#F5F5F5', muted: '#999999', placeholder: '#777777',
  send: '#F5F5F5', sendIcon: '#101010', buttonIcon: '#F5F5F5', icon: '#F5F5F5', backIcon: '#F5F5F5',
  brand: '#F5F5F5', search: '#202020', searchIcon: '#999999',
  title: '#F5F5F5', preview: '#999999', divider: '#303030',
  userName: '#F5F5F5', userAvatar: '#202020', userIcon: '#999999', settingsIcon: '#F5F5F5',
  bubble: '#202020', error: '#F08792', noticeError: '#FFB9B9', notice: '#202020', noticeBorder: '#303030',
};

/** Reference sidebar proportions; the create/search row spans the card list width. */
export const referenceSidebar = {
  viewportWidth: 618, width: 525,
  headerTop: 21, headerHeight: 76,
  brandFontSize: referenceTypography.logoFontSize, brandLineHeight: 54,
  searchTop: 123, searchLeft: 21, searchWidth: 483, searchHeight: 83, searchActionGap: 14,
  listGap: 32,
  rowInset: 21, textInset: 40, rowHeight: 83, rowRadius: 30, fontSize: referenceTypography.titleFontSize, lineHeight: referenceTypography.titleLineHeight,
  cardImage: 60, cardImageGap: 18,
  footerBottom: 27, footerHeight: 83, avatar: 69, accountAvatarLeft: 27, accountNameLeft: 117,
  historyBottomGap: 16, historyPadding: 14,
} as const;

export function sidebarWidth(viewportWidth: number) {
  return Math.min(viewportWidth * referenceSidebar.width / referenceSidebar.viewportWidth, 400);
}

/** Keep card, chat title, composer and message type at the same rendered size. */
export function typographyScale(viewportWidth: number) {
  return sidebarWidth(viewportWidth) / referenceSidebar.width;
}

export type ChatColors = typeof darkChatColors;

/** Monochrome surfaces and black primary actions from the Threads references. */
export const lightChatColors: ChatColors = {
  background: '#FFFFFF', drawer: '#FFFFFF', drawerPreview: '#FFFFFF',
  historySelected: '#F5F5F5', historyPressed: '#EEEEEE',
  header: '#FFFFFF', headerBorder: '#E5E5E5', headerPressed: '#F5F5F5', actionPressed: '#EEEEEE',
  composer: '#F5F5F5', border: '#E5E5E5', button: '#F5F5F5',
  text: '#0A0A0A', muted: '#999999', placeholder: '#A0A0A0',
  send: '#000000', sendIcon: '#FFFFFF', buttonIcon: '#0A0A0A', icon: '#0A0A0A', backIcon: '#0A0A0A',
  brand: '#0A0A0A', search: '#F5F5F5', searchIcon: '#999999',
  title: '#0A0A0A', preview: '#999999', divider: '#DEDEDE',
  userName: '#0A0A0A', userAvatar: '#EEEEEE', userIcon: '#999999', settingsIcon: '#0A0A0A',
  bubble: '#F5F5F5', error: '#D60026', noticeError: '#A72E2E', notice: '#F5F5F5', noticeBorder: '#DEDEDE',
};

const avatarColors = ['#499CC4', '#8270B5', '#4B928A', '#BA8958', '#657BAE'];

export function chatAvatarColor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return avatarColors[hash % avatarColors.length];
}

export function composerScale(width: number) {
  return (width > 600 ? 412 : width) / referenceComposer.viewportWidth;
}
