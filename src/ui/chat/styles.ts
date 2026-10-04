import {themedStyles} from '../Theme';

export const useChatStyles = themedStyles(colors => ({
  screen: {flex: 1, minHeight: 0, backgroundColor: colors.background},
  header: {flexDirection: 'row', alignItems: 'center', flexShrink: 0, backgroundColor: colors.background},
  headerAvatar: {width: 36, height: 36, borderRadius: 18, overflow: 'hidden', marginLeft: 8, backgroundColor: colors.surface},
  headerName: {fontSize: 18, fontWeight: '600', color: colors.foreground, marginLeft: 12, flex: 1},
  messages: {flex: 1, minHeight: 0}, messageBody: {paddingHorizontal: 14, paddingTop: 6, paddingBottom: 12},
  messageRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 10},
  avatarSpace: {width: 32, flexShrink: 0}, avatar: {width: 32, height: 32, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface},
  bubble: {maxWidth: '78%', flexShrink: 1, borderRadius: 24, paddingHorizontal: 15, paddingVertical: 11, overflow: 'hidden'},
  messageText: {fontSize: 17, lineHeight: 25, includeFontPadding: false}, messageImage: {width: 200, maxWidth: '100%', height: 160, borderRadius: 12, overflow: 'hidden', marginVertical: 3},
  attachmentPanel: {paddingHorizontal: 20, paddingBottom: 10}, attachmentHeading: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  panelTitle: {fontSize: 16, fontWeight: '600', color: colors.foreground}, attachmentPictures: {gap: 8},
  attachmentPicture: {width: 88, height: 88, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface},
  menu: {position: 'absolute', zIndex: 3, padding: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background},
  menuItem: {padding: 14, minHeight: 48},
}));
