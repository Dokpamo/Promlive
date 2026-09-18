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
  drawer: '#181818',
  composer: '#282828',
  border: '#444444',
  button: '#303030',
  text: '#E4E4E4',
  muted: '#929292',
  placeholder: '#777777',
  send: '#D1D1D1',
};

export function composerScale(width: number) {
  return (width > 600 ? 412 : width) / referenceComposer.viewportWidth;
}
