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

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
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

function send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const { body, headers, ...rest } = options;

  return fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
      ...headers
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options, readToken());

  // A 401 means the stored token is dead, whatever it looked like. Drop it and
  // try the sign-in exchange exactly once, then replay. Never a loop: a second
  // 401 with a token minted seconds ago is a broken session layer, not a stale
  // token, and the caller should see the error.
  if (response.status === 401 && path !== LOGIN_PATH) {
    clearToken();
    const token = reauthenticate === null ? null : await reauthenticate();
    if (token !== null) response = await send(path, options, token);
  }

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!payload) {
    throw new ApiRequestError(response.status, 'internal_error', 'The server sent no answer.');
  }
  if (!payload.ok) {
    throw new ApiRequestError(
      response.status,
      payload.error.code,
      payload.error.message,
      payload.error.fields ?? {}
    );
  }

  return payload.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body })
};
