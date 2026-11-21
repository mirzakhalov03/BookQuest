import type { Context } from 'telegraf';
import { openAppKeyboard } from '../keyboards.js';
import { TEXTS } from '../texts.js';

/** Reached from the menu button and the poster's inline button; ends on the one action that matters. */
export async function handleGuide(ctx: Context): Promise<void> {
  // An unanswered callback leaves the button spinning.
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  await ctx.reply(TEXTS.guide, { parse_mode: 'HTML', ...openAppKeyboard });
}
