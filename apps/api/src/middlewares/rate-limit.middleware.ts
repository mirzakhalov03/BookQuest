import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

/**
 * In-memory counters. Correct for a single instance, which is what this service
 * runs as; a multi-instance deployment needs a shared store (Redis) or each
 * instance enforces its own share of the limit.
 */
function limiter(options: {
  windowMs: number;
  limit: number;
  message: string;
  key?: (req: Request) => string;
}) {
  const handler: Options['handler'] = (_req, res, next) => {
    res.setHeader('Retry-After', Math.ceil(options.windowMs / 1000));
    next(ApiError.tooManyRequests(options.message));
  };

  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // ipKeyGenerator normalises IPv6 to a /64 subnet, so one address family
    // cannot rotate its way around the limit.
    keyGenerator: options.key ?? ((req) => ipKeyGenerator(req.ip ?? '')),
    handler
  });
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Every request. A blunt ceiling so one client cannot saturate the process. */
export const globalRateLimit = limiter({
  windowMs: MINUTE,
  limit: env.RATE_LIMIT_GLOBAL_PER_MINUTE,
  message: 'Slow down a moment, then try again.'
});

/** Sign-in is unauthenticated, so this one can only be keyed by IP. */
export const authRateLimit = limiter({
  windowMs: MINUTE,
  limit: env.RATE_LIMIT_AUTH_PER_MINUTE,
  message: 'Too many sign-in attempts. Try again in a minute.'
});

/**
 * Registration is keyed per user, not per IP: a whole school behind one address
 * would otherwise lock each other out, and the route requires a session anyway.
 */
export const registerRateLimit = limiter({
  windowMs: HOUR,
  limit: env.RATE_LIMIT_REGISTER_PER_HOUR,
  message: 'That is a lot of attempts. Try again in a little while.',
  key: (req) => req.currentUser?.id ?? ipKeyGenerator(req.ip ?? '')
});
