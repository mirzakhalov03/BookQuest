import type { Context } from 'telegraf';
import { logger } from '../config/logger.js';
import { toBotUserUpsertPayload, upsertUser } from '../lib/api-client.js';
import { closeFeedbackSession } from '../lib/feedback-state.js';
import { mainKeyboard, openAppKeyboard } from '../keyboards.js';
import { TEXTS } from '../texts.js';

/**
 * Two messages, not one: a message carries either a reply keyboard or an
 * inline keyboard, never both. The first pins the bottom menu; the second
 * carries the one action that matters.
 */
export async function handleStart(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  // /start is the reset: it re-sends the main keyboard, so the feedback chat ends with it.
  closeFeedbackSession(ctx.from.id);
  await upsertUser(toBotUserUpsertPayload(ctx.from));

  await ctx.reply(TEXTS.welcome, mainKeyboard);
  await ctx.reply(TEXTS.getStarted, openAppKeyboard);

  logger.info({ telegramUserId: String(ctx.from.id) }, 'Handled /start');
}
