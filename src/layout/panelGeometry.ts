import {headerScale} from './metrics';

const rowInset = 28;

/** Flat 618px reference layout shared by settings and editing surfaces. */
export const panelReference = {
  contentMaxWidth: 560,
  inset: 28, top: 42, radius: 24, controlRadius: 12, groupGap: 18, groupPadding: 14,
  rowHeight: 82, rowInset, rowPadding: 17, rowFont: 26, rowLine: 36, valueFont: 24,
  // Bring the underline into the field's padding without moving text or its touch target.
  inputUnderlineInset: 8,
  subtitle: {fontSize: 24, lineHeight: 34, bottom: 16, sectionTop: 14},
  highlightInset: 8,
  toggle: {width: 76, height: 44, inset: 4},
  profileSize: 180, profileInset: 34, profileGap: 20, profilePadding: 8,
  // The header already leaves 20px below its buttons; balance the remaining gaps.
  profileTop: 8, profileBottom: 28,
  sheetInset: 17, sheetPadding: rowInset, sheetContentGap: 38,
  sheetHandle: {width: 48, height: 4, radius: 2, top: 20},
} as const;

/** Fit every setting-group measurement by the same rendered-width ratio. */
export function panelGroupScale(viewportWidth: number, targetWidth: number, horizontalSafeArea = 0) {
  const scale = headerScale(viewportWidth);
  const groupWidth = Math.min(viewportWidth - horizontalSafeArea, panelReference.contentMaxWidth)
    - 2 * panelReference.inset * scale;
  return scale * targetWidth / Math.max(1, groupWidth);
}
