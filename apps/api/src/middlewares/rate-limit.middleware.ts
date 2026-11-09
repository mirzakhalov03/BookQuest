import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';
import { readBearerToken, readSessionToken } from '../utils/token.js';

/**
 * In-memory counters. Correct for a single instance, which is what this service
 * runs as; a multi-instance deployment needs a shared store (Redis) or each
 * instance enforces its own share of the limit.
 */
function limiter(options: {
  windowMs: number;
  limit: number;
  message: string;
  key?: (req: Request) => string | Promise<string>;
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
    keyGenerator: options.key ?? ipKey,
    handler
  });
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const ipKey = (req: Request): string => ipKeyGenerator(req.ip ?? '');

/**
 * The signed-in user where there is one, else the IP — a school or a carrier
 * NAT puts many people behind one address. The token is verified, so a forged
 * one can't mint fresh buckets.
 */
async function userOrIpKey(req: Request): Promise<string> {
  const token = readBearerToken(req.headers.authorization);
  const userId = token ? await readSessionToken(token) : null;
  return userId ? `user:${userId}` : ipKey(req);
}

/** Every request. A blunt ceiling so one client cannot saturate the process. */
export const globalRateLimit = limiter({
  windowMs: MINUTE,
  limit: env.RATE_LIMIT_GLOBAL_PER_MINUTE,
  message: 'Slow down a moment, then try again.',
  key: userOrIpKey
});

/**
 * The Mini App's initData exchange. A broadcast sends many people from one
 * network in at once, and every call needs a valid Telegram signature, so
 * this can be far looser than the password and code routes.
 */
export const telegramAuthRateLimit = limiter({
  windowMs: MINUTE,
  limit: env.RATE_LIMIT_TELEGRAM_AUTH_PER_MINUTE,
  message: 'Too many sign-in attempts. Try again in a minute.'
});

/** Each request DMs a real person, so an hourly cap stops sweeping the sequential reg numbers. */
export const loginCodeRateLimit = limiter({
  windowMs: HOUR,
  limit: env.RATE_LIMIT_LOGIN_CODE_PER_HOUR,
  message: 'Too many codes requested. Try again later, or log in with your password.'
});

/** Password and code sign-in are unauthenticated, so this one can only be keyed by IP. */
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
  key: (req) => req.currentUser?.id ?? ipKey(req)
});
