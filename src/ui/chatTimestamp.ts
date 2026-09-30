const minute = 60_000;
const hour = 60 * minute;

/** Use elapsed time below 24 hours, then the device's local calendar date. */
export function formatChatTimestamp(lastChatAt: number, now = Date.now()): string {
  const date = new Date(lastChatAt);
  const today = new Date(now);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(today.getTime())) return '';

  const elapsed = Math.max(0, now - lastChatAt);
  if (elapsed < minute) return '방금';
  if (elapsed < hour) return `${Math.floor(elapsed / minute)}분 전`;
  if (elapsed < 24 * hour) return `${Math.floor(elapsed / hour)}시간 전`;

  const monthDay = `${date.getMonth() + 1}. ${date.getDate()}.`;
  return date.getFullYear() === today.getFullYear() ? monthDay : `${date.getFullYear()}. ${monthDay}`;
}
