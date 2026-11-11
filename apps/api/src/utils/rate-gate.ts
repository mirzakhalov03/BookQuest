/* Shared by broadcasts and certificate delivery: both DM many people under one Telegram budget. */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Spaces calls across all workers; `pause` pushes every later call back (Telegram's 429). */
export function createRateGate(perSecond: number) {
  const spacingMs = 1000 / perSecond;
  let nextAt = 0;
  return {
    async wait(): Promise<void> {
      const now = Date.now();
      const at = Math.max(now, nextAt);
      nextAt = at + spacingMs;
      if (at > now) await sleep(at - now);
    },
    pause(ms: number): void {
      nextAt = Math.max(nextAt, Date.now() + ms);
    }
  };
}
