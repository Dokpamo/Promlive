export type HeaderScrollPosition = {
  offset: number;
  hidden: number;
  height: number;
  maxOffset: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Track distance, not just direction, so reversing a drag reveals the same distance. */
export function advanceHeaderScroll(position: HeaderScrollPosition, offset: number, maxOffset: number): HeaderScrollPosition {
  const limit = Math.max(0, maxOffset);
  const nextOffset = clamp(offset, 0, limit);
  return {...position, offset: nextOffset, maxOffset: limit,
    hidden: limit <= position.height ? 0 : clamp(position.hidden + nextOffset - position.offset, 0, position.height)};
}

export type HeaderSettleTarget = {offset: number};

/** Finish through the list's offset so the header and content always travel together. */
export function headerSettleTarget({offset, hidden, height, maxOffset}: HeaderScrollPosition): HeaderSettleTarget | null {
  if (height <= 0 || hidden < 0.5 || height - hidden < 0.5) return null;
  const hide = hidden >= height / 2;
  const target = hide ? offset + height - hidden : offset - hidden;
  const nextOffset = clamp(target, 0, maxOffset);
  return Math.abs(nextOffset - offset) < 0.5 ? null : {offset: nextOffset};
}
