const titleFontSize = 28;

/** Shared title and brand sizes in the 618px reference. */
export const referenceTypography = {
  titleFontSize,
  titleLineHeight: 37,
  titleWeight: '400',
  logoFontSize: titleFontSize * 1.5,
  logoWeight: '400',
} as const;

/** Shared header proportions from photo_6161248182776566795_y.jpg (618px wide). */
export const referenceHeader = {
  viewportWidth: 618,
  inset: 28,
  top: 0,
  barHeight: 96,
  height: 76,
  gap: 20,
  actions: 158,
  actionGap: 6,
  highlight: 70,
  avatar: 68,
  avatarInset: 4,
  titleInset: 82,
  titleFont: referenceTypography.titleFontSize,
  icon: 32,
} as const;

export function headerScale(width: number) {
  return (width > 600 ? 412 : width) / referenceHeader.viewportWidth;
}
