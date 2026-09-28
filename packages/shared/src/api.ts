/**
 * The envelope every endpoint answers with. A single shape means the client
 * has one place to unwrap data and one place to surface an error, including
 * per-field messages coming back from validation.
 */
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    /** Field path -> message, for forms. */
    fields?: Record<string, string>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const API_ERROR_CODES = [
  'validation_failed',
  'not_found',
  'conflict',
  'unauthorized',
  /** Authenticated, but not allowed — admin-only routes. */
  'forbidden',
  /** Existed once, gone now — an expired or used-up login code. */
  'expired',
  /** Understood, but can't be done for this account — e.g. no Telegram to send a code to. */
  'unprocessable',
  'rate_limited',
  'internal_error'
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Page of results, used by the archive and the admin lists. */
export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

/** Cursor page, used where "total" would cost a second query for no benefit. */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
