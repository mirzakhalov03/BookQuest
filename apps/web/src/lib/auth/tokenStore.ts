import type { Session } from '@bookquest/shared';

/**
 * The session token, kept outside React on purpose.
 *
 * The very first request of a page load has to carry it, and that happens
 * before any component has rendered — so this reads synchronously from
 * `localStorage` rather than living in state (spec §5). The token is opaque:
 * nothing here ever looks inside it.
 */

const STORAGE_KEY = 'bookquest.token';

interface StoredToken {
  token: string;
  /** ISO timestamp from the login response, so we can drop a dead token without asking the API. */
  expiresAt: string;
}

/**
 * Some embedded webviews throw on `localStorage` when site data is disabled.
 * A browser that cannot keep a token degrades to read-only mode; it does not
 * take the app down with it.
 */
function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was stored in the first place.
  }
}

export function readToken(): string | null {
  const raw = readRaw();
  if (!raw) return null;

  let stored: StoredToken;
  try {
    stored = JSON.parse(raw) as StoredToken;
  } catch {
    // Something else wrote to our key. Treat it as absent and take the key back.
    clearToken();
    return null;
  }

  // An unparseable expiry is NaN, and every comparison against NaN is false —
  // so without the explicit check a corrupted date would defeat the expiry test
  // rather than fail it. Treat anything we cannot read as already gone.
  const expiresAt = Date.parse(stored.expiresAt);
  if (!stored.token || Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
    clearToken();
    return null;
  }

  return stored.token;
}

/** Called with the login response, which supplies both halves. */
export function storeToken({ token, expiresAt }: Session): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, expiresAt }));
  } catch {
    // Storage is blocked. Every later read returns null, so the app falls back
    // to signing in again on demand instead of failing outright.
  }
}
