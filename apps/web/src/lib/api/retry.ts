import { ApiRequestError } from './client';

const BACKOFF_MS = [500, 1000, 2000, 4000];

const isRetryable = (error: unknown): error is ApiRequestError =>
  error instanceof ApiRequestError &&
  (error.status === 0 || error.status === 429 || error.status >= 500);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface RetryOptions {
  /** Checked before each retry; true stops and rethrows the last error. */
  until?: () => boolean;
  maxAttempts?: number;
}

/** Retries transient failures (network, 429, 5xx) with backoff; other errors throw at once. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { until, maxAttempts = 8 }: RetryOptions = {}
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryable(error) || attempt >= maxAttempts || until?.()) throw error;
      const backoff = BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)] ?? 4000;
      await sleep(
        error.status === 429 && error.retryAfterMs !== null ? error.retryAfterMs : backoff
      );
    }
  }
}
