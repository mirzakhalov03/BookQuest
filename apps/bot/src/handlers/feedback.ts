import type { Context, MiddlewareFn } from 'telegraf';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  closeFeedbackSession,
  inFeedbackSession,
  openFeedbackSession
} from '../lib/feedback-state.js';
import { relay } from '../lib/relay.js';
import { react } from '../lib/react.js';
import { feedbackKeyboard, feedbackReplyKeyboard, mainKeyboard } from '../keyboards.js';
import { TEXTS } from '../texts.js';

export async function handleFeedbackOpen(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  openFeedbackSession(ctx.from.id);
  await ctx.reply(TEXTS.feedbackIntro, feedbackKeyboard);
}

export async function handleFeedbackClose(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  closeFeedbackSession(ctx.from.id);
  await ctx.reply(TEXTS.feedbackClosed, mainKeyboard);
}

/** While in the feedback chat, every message goes to the organizers; otherwise falls through. */
export const handleFeedbackMessage: MiddlewareFn<Context> = async (ctx, next) => {
  if (!ctx.from || !ctx.message || !inFeedbackSession(ctx.from.id)) return next();

  try {
    // No name or tag: the reply button already knows who to answer.
    await relay(ctx.telegram, env.ADMIN_CHAT_ID!, ctx.message, TEXTS.feedbackNewMessageHeader, {
      replyMarkup: feedbackReplyKeyboard(ctx.from.id).reply_markup,
      quote: true
    });
    await react(ctx.telegram, ctx.chat!.id, ctx.message.message_id);
  } catch (error) {
    logger.error({ err: error, telegramUserId: String(ctx.from.id) }, 'Could not relay feedback');
    await ctx.reply(TEXTS.feedbackFailed);
  }
};
