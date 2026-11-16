import type { Context } from 'telegraf';
import { feedbackEnabled, openAppKeyboard } from '../keyboards.js';
import { TEXTS } from '../texts.js';

/** Any text no other handler claimed gets pointed at the one button that matters. */
export async function handleFallback(ctx: Context): Promise<void> {
  await ctx.reply(feedbackEnabled ? TEXTS.fallbackWithFeedback : TEXTS.fallback, openAppKeyboard);
}
