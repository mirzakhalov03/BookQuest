// Deliberately does nothing but pass every request straight through.
// Installability requires a registered service worker with a fetch handler;
// it does not require that handler to cache anything. Offline support is
// out of scope (see the design spec's non-goals) — this is not a stub
// waiting to be finished, it is the whole feature.
self.addEventListener('fetch', () => {});
