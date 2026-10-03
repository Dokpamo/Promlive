/** Logical desktop sizes; mobile reference measurements stay unchanged. */
export const desktopMetrics = {
  scale: 24 / 44,
  rail: 64,
  icon: 24,
  heading: {fontSize: 22, lineHeight: 28},
  body: {fontSize: 14, lineHeight: 20},
  secondary: {fontSize: 12, lineHeight: 18},
  conversation: {fontSize: 15, lineHeight: 22},
  rowHeight: 46,
  fieldHeight: 40,
} as const;
