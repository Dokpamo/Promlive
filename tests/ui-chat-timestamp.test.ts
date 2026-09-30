import {describe, expect, it} from 'vitest';
import {formatChatTimestamp} from '../src/ui/chatTimestamp';

const minute = 60_000;
const hour = 60 * minute;
const now = new Date(2026, 8, 30, 15, 30).getTime();

describe('chat timestamps', () => {
  it.each([
    [0, '방금'],
    [minute - 1, '방금'],
    [minute, '1분 전'],
    [hour - 1, '59분 전'],
    [hour, '1시간 전'],
    [3 * hour + 25 * minute, '3시간 전'],
    [24 * hour - 1, '23시간 전'],
  ])('formats an elapsed %i ms as %s', (elapsed, expected) => {
    expect(formatChatTimestamp(now - elapsed, now)).toBe(expected);
  });

  it('switches to the local month and day at exactly 24 hours', () => {
    expect(formatChatTimestamp(now - 24 * hour, now)).toBe('9. 29.');
    expect(formatChatTimestamp(new Date(2026, 0, 5, 12).getTime(), now)).toBe('1. 5.');
  });

  it('includes the year only for older chats in another calendar year', () => {
    expect(formatChatTimestamp(new Date(2025, 11, 31, 12).getTime(), now)).toBe('2025. 12. 31.');
    const newYear = new Date(2027, 0, 1, 1).getTime();
    expect(formatChatTimestamp(newYear - 2 * hour, newYear)).toBe('2시간 전');
    expect(formatChatTimestamp(newYear - 24 * hour, newYear)).toBe('2026. 12. 31.');
  });

  it('handles clock skew without negative times and omits invalid dates', () => {
    expect(formatChatTimestamp(now + minute, now)).toBe('방금');
    expect(formatChatTimestamp(Number.NaN, now)).toBe('');
    expect(formatChatTimestamp(now, Number.POSITIVE_INFINITY)).toBe('');
  });
});
