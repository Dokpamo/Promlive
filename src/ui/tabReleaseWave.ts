/** Approved “잔잔한 물결” sample. Every pulse starts at rest on release. */
export const tabPressFeedback = {releaseMs: 620, fillMs: 180, cycles: 1.9, decay: 5.2,
  horizontal: .19, vertical: .19, verticalDelayMs: 24, waveDelayMs: 45, ripple: .055, travel: .65} as const;

const smooth = (value: number) => {const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t);};
function envelope(t: number) {
  return t <= 0 || t >= 1 ? 0 : (1 - Math.exp(-50 * t)) * Math.exp(-tabPressFeedback.decay * t) * (1 - smooth((t - .8) / .2));
}
const pulse = (t: number) => envelope(t) * Math.sin(2 * Math.PI * tabPressFeedback.cycles * t);
const delayed = (t: number, delay: number) => (t - delay / tabPressFeedback.releaseMs) / (1 - delay / tabPressFeedback.releaseMs);

export function releaseWaveFrame(progress: number, horizontalPosition = 0) {
  const scaleX = 1 + tabPressFeedback.horizontal * pulse(progress);
  const scaleY = 1 - tabPressFeedback.vertical * pulse(delayed(progress, tabPressFeedback.verticalDelayMs));
  const waveTime = delayed(progress, tabPressFeedback.waveDelayMs);
  const amplitude = tabPressFeedback.ripple * envelope(waveTime);
  const phase = 2 * Math.PI * tabPressFeedback.cycles * waveTime - horizontalPosition * tabPressFeedback.travel;
  // Tangent-aligned strips reproduce the subtle local curve at icon size,
  // without resampling images on the JS thread every frame.
  const offset = amplitude * Math.sin(phase) * .9 / scaleY;
  const slope = -amplitude * tabPressFeedback.travel * Math.cos(phase) * .9 / scaleY;
  return {scaleX, scaleY, offset, shear: Math.atan(slope)};
}

export const waveSamples = Array.from({length: 63}, (_, index) => index / 62);
