import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

/**
 * Authenticates `apps/bot` itself, not a person signed in through it. A
 * single shared header, checked on every call — the bot equivalent of
 * requireUser/requireAdmin, but there is no session to resolve because the
 * caller isn't a browser and never will produce a signed initData string.
 */
export const requireBotService: RequestHandler = (req, _res, next) => {
  const token = req.header('X-Bot-Service-Token');
  if (!token || token !== env.BOT_SERVICE_TOKEN) {
    next(ApiError.unauthorized('Not allowed.'));
    return;
  }
  next();
};
