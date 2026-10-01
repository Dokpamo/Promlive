/** Web/desktop animation values are updated synchronously. */
export function animationBatch(update: () => void) { update(); }
