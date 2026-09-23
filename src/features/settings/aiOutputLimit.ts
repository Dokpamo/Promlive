export const defaultMaxOutputTokens = 10_000;

/** A model's advertised output ceiling can be lower than the app's default. */
function withinModelLimit(tokens: number, modelMaximum?: number): number {
  return modelMaximum !== undefined && Number.isSafeInteger(modelMaximum) && modelMaximum > 0
    ? Math.min(tokens, modelMaximum) : tokens;
}

/** Keep incomplete/invalid edits visible; never turn them into an unlimited request. */
export function outputLimitValue(value: string, modelMaximum?: number): string {
  const text = value.trim();
  if (!text) return String(withinModelLimit(defaultMaxOutputTokens, modelMaximum));
  const tokens = Number(text);
  return /^\d+$/.test(text) && Number.isSafeInteger(tokens) && tokens > 0
    ? String(withinModelLimit(tokens, modelMaximum)) : value;
}

export function resolveOutputLimit(value: string, modelMaximum?: number): number {
  const text = outputLimitValue(value, modelMaximum);
  const tokens = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(tokens) || tokens < 1) {
    throw new Error('최대 생성 토큰에 1 이상의 정수를 입력해 주세요.');
  }
  return tokens;
}
