const titleFontSize = 28;

/** Shared title and brand sizes in the 618px reference. */
export const referenceTypography = {
  titleFontSize,
  titleLineHeight: 37,
  titleWeight: '400',
  logoFontSize: titleFontSize * 1.5,
  logoWeight: '400',
} as const;

/** Compact reference title for navigation pages. */
export const referencePageTitle = {fontSize: 36, lineHeight: 46, fontWeight: '700'} as const;

/** Flat header proportions measured in the 618px reference screenshots. */
export const referenceHeader = {
  viewportWidth: 618,
  inset: 17,
  top: 0,
  barHeight: 96,
  height: 66,
  gap: 8,
  actions: 132,
  actionGap: 0,
  highlight: 60,
  avatar: 68,
  avatarInset: 4,
  titleInset: 82,
  titleFont: 32,
  icon: 36,
} as const;

export function headerScale(width: number) {
  return (width > 600 ? 412 : width) / referenceHeader.viewportWidth;
}
