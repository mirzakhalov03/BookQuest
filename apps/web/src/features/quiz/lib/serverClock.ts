/**
 * The server's clock, as seen from here (§12.4). Every quiz response carries
 * `serverNow`; the offset is that minus the request's midpoint, median of the
 * last 3 so one slow response can't jerk the timer. A wrong device clock
 * changes nothing: the offset absorbs it.
 */

const SAMPLES = 3;
let samples: number[] = [];
let offsetMs = 0;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function recordServerTime(serverNowIso: string, sentAt: number, receivedAt: number): void {
  const server = Date.parse(serverNowIso);
  if (Number.isNaN(server)) return;
  samples = [...samples, server - (sentAt + receivedAt) / 2].slice(-SAMPLES);
  offsetMs = median(samples);
}

export const serverNow = (): number => Date.now() + offsetMs;

/** Runs one request and records its `serverNow` against its own round trip. */
export async function timed<T extends { serverNow: string }>(call: () => Promise<T>): Promise<T> {
  const sentAt = Date.now();
  const result = await call();
  recordServerTime(result.serverNow, sentAt, Date.now());
  return result;
}
