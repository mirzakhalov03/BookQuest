import { ApiRequestError } from './client';

const BACKOFF_MS = [500, 1000, 2000, 4000];
const MAX_WAIT_MS = BACKOFF_MS[BACKOFF_MS.length - 1]!;

const isRetryable = (error: unknown): error is ApiRequestError =>
  error instanceof ApiRequestError &&
  (error.status === 0 || error.status === 429 || error.status >= 500);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface RetryOptions {
  /** Checked before and after each wait; true stops and rethrows the last error. */
  until?: () => boolean;
  /** Ms left before retrying is pointless; caps each wait so a retry can still land in time. */
  remainingMs?: () => number;
  maxAttempts?: number;
}

/** Retries transient failures (network, 429, 5xx) with backoff; other errors throw at once. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { until, remainingMs, maxAttempts = 8 }: RetryOptions = {}
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryable(error) || attempt >= maxAttempts || until?.()) throw error;
      const backoff = BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)] ?? MAX_WAIT_MS;
      // The limiter's Retry-After is its whole window (60 s); honouring it uncapped stalls a live answer.
      const wanted = error.status === 429 && error.retryAfterMs !== null ? Math.min(error.retryAfterMs, MAX_WAIT_MS) : backoff;
      await sleep(Math.max(0, Math.min(wanted, remainingMs?.() ?? Infinity)));
      if (until?.()) throw error;
    }
  }
}
