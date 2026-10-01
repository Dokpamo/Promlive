/** Photo width is 618px; the app's reference viewport is 412dp. */
export function inputMetrics(width: number, fontScale = 1) {
  const scale = Math.min(width, 412) / 618;
  const lineHeight = 37 * scale, line = lineHeight * fontScale;
  return {
    scale, gap: 14 * scale, radius: 38 * scale,
    fontSize: 25.5 * scale, lineHeight, line,
    textInset: 27 * scale, textTop: 21 * scale, textMinHeight: 42 * scale,
    textToActions: 18 * scale, actionBottom: 12 * scale, actionSide: 9 * scale,
    actionSize: Math.max(44, 60 * scale), circleSize: 60 * scale, iconSize: 36 * scale,
    maxLines: 7, maxLength: 8000, photoSize: 88, photoGap: 12,
  };
}
export type InputMetrics = ReturnType<typeof inputMetrics>;

export function inputLayout(metrics: InputMetrics, contentHeight: number, hasImage: boolean) {
  const textHeight = Math.max(metrics.line, Math.min(contentHeight, metrics.line * metrics.maxLines));
  const photoHeight = hasImage ? metrics.photoSize + metrics.photoGap : 0;
  const height = metrics.textTop + photoHeight + Math.max(metrics.textMinHeight, textHeight) + metrics.textToActions + metrics.actionSize + metrics.actionBottom;
  return {height, textHeight, photoHeight, scrollable: contentHeight > textHeight + 1};
}
