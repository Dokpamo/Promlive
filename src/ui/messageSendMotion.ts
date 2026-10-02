/** The first approved send sample: fixed right edge, a soft squeeze and a small overshoot. */
export const messageSendDuration = 620;
const response = (t: number) => 1 - Math.exp(-6 * t) * (Math.cos(4.8 * t) + 1.25 * Math.sin(4.8 * t));
export function messageSendProgress(t: number) {
  return response(Math.max(0, Math.min(1, t))) / response(1);
}
export function messageSendSqueeze(t: number) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (1 - t) ** 5 / ((2 / 7) ** 2 * (5 / 7) ** 5);
}
export type SendLayout = {rowBottom: number; bubbleHeight: number; contentHeight: number; viewportHeight: number;
  oldOffset: number; composerHeight: number; textTop: number};
export function messageSendLayout(p: SendLayout) {
  const offset = Math.max(0, p.contentHeight - p.viewportHeight);
  const bottom = p.viewportHeight + offset - p.rowBottom;
  // Composer height includes its safe-area gap and the extra 10dp body backing.
  const travel = Math.max(0, bottom + p.bubbleHeight - p.composerHeight + 10 + p.textTop);
  return {offset, bottom, travel, historyShift: offset - p.oldOffset};
}

export const sendSamples = Array.from({length: 76}, (_, i) => i / 75);
export const sendRemaining = sendSamples.map(t => 1 - messageSendProgress(t));
export const sendSqueeze = sendSamples.map(messageSendSqueeze);
