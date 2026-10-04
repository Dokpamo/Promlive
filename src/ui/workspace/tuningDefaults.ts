/** Bounded independently of total archive size; benchmarked by scripts/performance. */
export const workspaceDefaults = {
  listPage: 24,
  messagePage: 16,
  messageCharacters: 16_000,
  retainedCharacters: 64_000,
  retainedMessages: 160,
  prefetchScreens: 2,
  renderWindow: 3,
  desktopRenderWindow: 5,
  renderBatch: 4,
  cacheCharacters: 120_000,
  cachedCollections: 4,
  draftDelay: 250,
};
