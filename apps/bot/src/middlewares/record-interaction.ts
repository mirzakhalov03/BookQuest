import type { Context, MiddlewareFn } from 'telegraf';
import { logger } from '../config/logger.js';
import { toInteraction } from '../lib/interactions.js';
import { recordInteraction } from '../lib/interaction-recorder.js';

/** First in the chain, so every update is seen even when no handler matches. A bug here logs and moves on. */
export const recordInteractionMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  try {
    const item = toInteraction(ctx.update, ctx.botInfo.id);
    if (item) recordInteraction(item);
  } catch (error) {
    logger.warn({ err: error, updateId: ctx.update.update_id }, 'Could not record interaction');
  }
  await next();
};
