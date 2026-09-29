/** New UI only. Values use the supplied 618px-wide navigation references. */
export const navigation = {
  referenceWidth: 618,
  headerHeight: 96,
  titleInset: 28,
  actionInset: 16,
  actionSize: 72,
  iconSize: 44,
  // Calibrated with the same "kazzonku" text as the reference, not Hangul ink height.
  titleSize: 38.5,
  titleLineHeight: 48,
  titleOffsetY: -2,
  tabHeight: 83,
  separatorHeight: 1,
  avatarSize: 44,
  avatarRingSize: 52,
} as const;

export const colors = {
  background: '#FFFFFF',
  foreground: '#0F1012',
  separator: '#EDEDED',
  avatarBackground: '#F3F4F6',
  avatarBorder: '#D8DCDE',
  avatarForeground: '#89919B',
} as const;

export function navigationScale(width: number) {
  return Math.min(width, 412) / navigation.referenceWidth;
}
