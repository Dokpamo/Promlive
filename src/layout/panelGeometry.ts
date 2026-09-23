import {headerScale, referenceTypography} from './metrics';

const rowInset = 34;

/** 618px reference geometry; panel corners follow photo_6159075255742305500_y.jpg. */
export const panelReference = {
  contentMaxWidth: 560,
  inset: 34, top: 42, radius: 48, controlRadius: 30, groupGap: 18, groupPadding: 14,
  rowHeight: 82, rowInset, rowPadding: 17, rowFont: referenceTypography.titleFontSize, rowLine: 40, valueFont: 26,
  subtitle: {fontSize: 24, lineHeight: 34, bottom: 16, sectionTop: 14},
  highlightInset: 8,
  toggle: {width: 76, height: 44, inset: 4},
  profileSize: 180, profileInset: 34, profileGap: 20, profileBottom: 42,
  sheetInset: 17, sheetPadding: rowInset, sheetContentGap: 38,
  sheetHandle: {width: 82, height: 7, radius: 4, top: 21},
} as const;

/** Fit every setting-group measurement by the same rendered-width ratio. */
export function panelGroupScale(viewportWidth: number, targetWidth: number, horizontalSafeArea = 0) {
  const scale = headerScale(viewportWidth);
  const groupWidth = Math.min(viewportWidth - horizontalSafeArea, panelReference.contentMaxWidth)
    - 2 * panelReference.inset * scale;
  return scale * targetWidth / Math.max(1, groupWidth);
}
