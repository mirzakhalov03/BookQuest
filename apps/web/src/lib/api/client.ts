import type { ApiResponse } from '@bookquest/shared';
import { clearToken, readToken } from '@/lib/auth/tokenStore';

// Fail loudly at load time rather than silently falling back — a wrong base
// URL surfaces as confusing network errors far from this file otherwise.
function readBaseUrl(): string {
  const value = import.meta.env.VITE_API_URL;
  if (!value) {
    throw new Error('VITE_API_URL is not set. Add it to the repo-root .env (see .env.example).');
  }
  return value;
}

const BASE_URL = readBaseUrl();

/** The login exchange is what we would retry *with*, so its own 401 is final. */
const LOGIN_PATH = '/auth/telegram';

/**
 * Thrown for any non-successful response. It carries the per-field messages
 * the API returns, so a form can drop them straight onto its inputs.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;
  /** Machine-readable sub-code; branch on this, never on `message`. */
  readonly reason: string | null;
  /** Server-requested wait from `Retry-After`, for the retry helper. */
  readonly retryAfterMs: number | null;

  constructor(
    status: number,
    code: string,
    message: string,
    fields: Record<string, string> = {},
    reason: string | null = null,
    retryAfterMs: number | null = null
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.reason = reason;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * The one 404 shape the frontend treats as "not yet" rather than a failure —
 * no quest running between editions, a quiz nobody has sat, results not
 * published. Every screen that meets it wants the same invitation framing
 * instead of `ErrorState`'s retry, so this is the one place that says what
 * counts, rather than nine call sites each spelling out the same three
 * checks (the analogous `isForbidden` already lives next to its one caller's
 * shape, `features/admin/components/ForbiddenState.tsx`).
 */
export function isNotFound(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && error.status === 404 && error.code === 'not_found';
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Aborts the request and throws `ApiRequestError(0, 'timeout')`. */
  timeoutMs?: number;
}

/**
 * Signs in again from the Telegram bridge and resolves to a fresh token, or to
 * null when there is nothing to sign in with.
 */
type Reauthenticate = () => Promise<string | null>;

let reauthenticate: Reauthenticate | null = null;

/**
 * The auth layer hands this in at boot. It cannot be imported directly: the
 * auth layer already imports this module, so the dependency has to point one
 * way and the re-login has to arrive from outside.
 */
export function registerReauthenticate(fn: Reauthenticate): void {
  reauthenticate = fn;
}

/** Seconds or an HTTP date, per RFC 9110. */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

async function send(
  path: string,
  options: RequestOptions,
  token: string | null,
  timeoutSignal: AbortSignal | null
): Promise<Response> {
  const { body, headers, timeoutMs: _timeoutMs, signal: callerSignal, ...rest } = options;
  const signals = [callerSignal, timeoutSignal].filter((s): s is AbortSignal => s != null);
  const signal = signals.length > 1 ? AbortSignal.any(signals) : signals[0];
  // The browser must write the multipart boundary itself, so FormData gets no Content-Type from us.
  const isForm = body instanceof FormData;

  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...rest,
      ...(signal ? { signal } : {}),
      headers: {
        ...(body === undefined || isForm ? {} : { 'Content-Type': 'application/json' }),
        ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
        // Free-tier ngrok shows a "Visit Site" interstitial to any request with a
        // real browser User-Agent — which the Telegram WebView always sends — and
        // that page has no CORS headers, so fetch() fails before a response ever
        // arrives. This header is ngrok's own opt-out; harmless off-tunnel.
        'ngrok-skip-browser-warning': 'true',
        ...headers
      },
      ...(body === undefined ? {} : { body: isForm ? body : JSON.stringify(body) })
    });
  } catch (error) {
    // A caller-initiated abort (e.g. React Query cancelling) is not a failure to report.
    if (callerSignal?.aborted) throw error;
    if (timeoutSignal?.aborted) {
      throw new ApiRequestError(0, 'timeout', 'The request took too long.');
    }
    if (
      error instanceof TypeError ||
      (error instanceof DOMException && error.name === 'AbortError')
    ) {
      throw new ApiRequestError(0, 'network', 'Could not reach the server.');
    }
    throw error;
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // One deadline for the whole request, body read included.
  const timeoutSignal =
    options.timeoutMs === undefined ? null : AbortSignal.timeout(options.timeoutMs);
  let response = await send(path, options, readToken(), timeoutSignal);

  // A 401 means the stored token is dead, whatever it looked like. Drop it and
  // try the sign-in exchange exactly once, then replay. Never a loop: a second
  // 401 with a token minted seconds ago is a broken session layer, not a stale
  // token, and the caller should see the error.
  if (response.status === 401 && path !== LOGIN_PATH) {
    clearToken();
    const token = reauthenticate === null ? null : await reauthenticate();
    if (token !== null) response = await send(path, options, token, timeoutSignal);
  }

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!payload) {
    // A deadline hit mid-body is a retryable timeout, not a broken server.
    if (timeoutSignal?.aborted) {
      throw new ApiRequestError(0, 'timeout', 'The request took too long.');
    }
    throw new ApiRequestError(response.status, 'internal_error', 'The server sent no answer.');
  }
  if (!payload.ok) {
    throw new ApiRequestError(
      response.status,
      payload.error.code,
      payload.error.message,
      payload.error.fields ?? {},
      payload.error.reason ?? null,
      parseRetryAfter(response.headers.get('Retry-After'))
    );
  }

  return payload.data;
}

type CallOptions = Pick<RequestOptions, 'timeoutMs' | 'signal'>;

export const api = {
  get: <T>(path: string, options?: CallOptions & Pick<RequestOptions, 'cache'>) =>
    request<T>(path, options),
  post: <T>(path: string, body: unknown, options?: CallOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  // The admin quest editor is the first caller: `strictObject().partial()` on
  // the server means a partial body is the contract, not a shortcut, so this
  // sends exactly what the caller builds — no merging happens here.
  patch: <T>(path: string, body: unknown, options?: CallOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body: unknown, options?: CallOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: CallOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
  upload: <T>(path: string, form: FormData, options?: CallOptions) =>
    request<T>(path, { ...options, method: 'POST', body: form })
};
