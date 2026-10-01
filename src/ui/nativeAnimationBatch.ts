// RN 0.81's own Animated batching also handles Fabric's signalled batches.
// Keep this version-specific adapter out of web and desktop bundles.
const {API} = require('react-native/src/private/animated/NativeAnimatedHelper').default as {
  API: {setWaitingForIdentifier: (id: string) => void; unsetWaitingForIdentifier: (id: string) => void};
};
let sequence = 0;
export function animationBatch(update: () => void) {
  const id = `promlive-page-handoff-${++sequence}`;
  API.setWaitingForIdentifier(id);
  try { update(); } finally { API.unsetWaitingForIdentifier(id); }
}
