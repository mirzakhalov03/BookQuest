import type { Response } from 'express';
import type { ApiSuccess } from '@bookquest/shared';

/** Every successful response leaves through here, so the envelope stays uniform. */
export function ok<T>(res: Response, data: T, status = 200): Response<ApiSuccess<T>> {
  return res.status(status).json({ ok: true, data });
}
