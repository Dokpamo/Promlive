/** New UI only. Values use the supplied 618px-wide navigation references. */
export const navigation = {
  referenceWidth: 618,
  headerHeight: 96,
  titleInset: 28,
  actionInset: 16,
  actionSize: 72,
  iconSize: 44,
  // Existing internal-screen back button inset, in dp (not reference units).
  backInset: 8,
  // Calibrated with the same "kazzonku" text as the reference, not Hangul ink height.
  titleSize: 38.5,
  titleLineHeight: 48,
  titleOffsetY: -2,
  tabHeight: 83,
  separatorHeight: 1,
} as const;

/** Existing chat/creation list text, also used by the flat settings list (dp/sp). */
export const listTypography = {
  fontSize: 16,
  lineHeight: 22,
  includeFontPadding: false,
} as const;

/** Settings-only spacing in reference units; shared sizes come from other tokens. */
export const settingsLayout = {
  iconGap: 32,
  userHeight: 162,
  userTopInset: 20,
  userTextGap: 12,
  rowHeight: 83,
  rowVerticalInset: 18,
} as const;

/** Shared neutral ramp. Components consume roles below, never separate grays. */
const neutral = {
  white: '#FFFFFF',
  nearWhite: '#F5F5F5',
  lightSurface: '#F2F2F2',
  lightSeparator: '#EDEDED',
  lightBorder: '#D8DCDE',
  secondary: '#777777',
  controlText: '#5B5B5B',
  darkBorder: '#3A3A3A',
  darkSurface: '#1E1E1E',
  charcoal: '#191919',
  black: '#101010',
} as const;

export const colorPalettes = {
  light: {
    background: neutral.white,
    surface: neutral.lightSurface,
    inputSurface: neutral.nearWhite,
    foreground: neutral.black,
    secondaryForeground: neutral.secondary,
    controlForeground: neutral.controlText,
    separator: neutral.lightSeparator,
    border: neutral.lightBorder,
    selectedBackground: neutral.charcoal,
    selectedForeground: neutral.white,
    error: '#B32323',
  },
  dark: {
    background: neutral.black,
    surface: neutral.darkSurface,
    inputSurface: neutral.darkSurface,
    foreground: neutral.nearWhite,
    secondaryForeground: neutral.secondary,
    controlForeground: neutral.nearWhite,
    separator: neutral.darkSurface,
    border: neutral.darkBorder,
    // Selection stays inverse: a light fill and dark text, including dark mode.
    selectedBackground: neutral.nearWhite,
    selectedForeground: neutral.black,
    error: '#FF8A8A',
  },
} as const;

/** Default for isolated previews/tests. Live screens consume the shared Theme provider. */
export const uiAppearance: keyof typeof colorPalettes = 'light';
export const colors = colorPalettes[uiAppearance];

/** Rounded filters measured from the KakaoTalk references at a 618px viewport. */
export const filterChips = {
  // Includes the reserved border; the native filled shape measures about 65px.
  height: 66,
  minWidth: 100,
  horizontalInset: 28,
  gap: 10,
  targetHeight: 72,
  bottomInset: 12,
  fontSize: 24,
  lineHeight: 32,
  textOffsetY: -1,
  borderWidth: 1,
} as const;

export const filterChipColors = {
  light: {
    surface: colorPalettes.light.background,
    background: colorPalettes.light.surface,
    foreground: colorPalettes.light.controlForeground,
    border: 'transparent',
    selectedBackground: colorPalettes.light.selectedBackground,
    selectedForeground: colorPalettes.light.selectedForeground,
  },
  dark: {
    surface: colorPalettes.dark.background,
    background: colorPalettes.dark.background,
    foreground: colorPalettes.dark.controlForeground,
    border: colorPalettes.dark.border,
    selectedBackground: colorPalettes.dark.selectedBackground,
    selectedForeground: colorPalettes.dark.selectedForeground,
  },
} as const;

export function filterChipsHeight(scale: number) {
  return Math.max(48, filterChips.targetHeight * scale) + filterChips.bottomInset * scale;
}

export function navigationScale(width: number) {
  return Math.min(width, 412) / navigation.referenceWidth;
}

/** Shared by header buttons and independent controls over artwork. */
export function navigationActionMetrics(scale: number) {
  const size = Math.max(48, navigation.actionSize * scale);
  return {size, iconSize: navigation.iconSize * scale,
    top: (navigation.headerHeight * scale - size) / 2,
    backInset: navigation.backInset, endInset: navigation.actionInset * scale};
}
