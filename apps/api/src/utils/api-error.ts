import type { ApiErrorCode } from '@bookquest/shared';

/**
 * The only error type controllers and services should throw. Anything else
 * reaching the error middleware is treated as a bug and reported as a 500
 * without leaking its message.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fields: Record<string, string> | undefined;
  readonly reason: string | undefined;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    fields?: Record<string, string>,
    reason?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.reason = reason;
  }

  static badRequest(message: string, fields?: Record<string, string>, reason?: string): ApiError {
    return new ApiError(400, 'validation_failed', message, fields, reason);
  }

  static notFound(message = 'Not found', options?: { reason?: string }): ApiError {
    return new ApiError(404, 'not_found', message, undefined, options?.reason);
  }

  static conflict(
    message: string,
    options?: { reason?: string; fields?: Record<string, string> }
  ): ApiError {
    return new ApiError(409, 'conflict', message, options?.fields, options?.reason);
  }

  static unauthorized(message = 'Not allowed', reason?: string): ApiError {
    return new ApiError(401, 'unauthorized', message, undefined, reason);
  }

  /** Authenticated, but not permitted. Distinct from 401 so the client knows
      re-authenticating will not help. */
  static forbidden(message = 'You do not have access to this.'): ApiError {
    return new ApiError(403, 'forbidden', message);
  }

  static gone(message: string, reason?: string): ApiError {
    return new ApiError(410, 'expired', message, undefined, reason);
  }

  static unprocessable(message: string, reason?: string): ApiError {
    return new ApiError(422, 'unprocessable', message, undefined, reason);
  }

  static tooManyRequests(message = 'Too many attempts. Try again shortly.', reason?: string): ApiError {
    return new ApiError(429, 'rate_limited', message, undefined, reason);
  }
}
