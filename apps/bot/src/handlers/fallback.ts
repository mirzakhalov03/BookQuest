import { Markup, type Context } from 'telegraf';
import { env } from '../config/env.js';

/**
 * Everything the old bot's keyboard used to do now lives in the Mini App.
 * Any text that isn't /start gets pointed at the one button that matters,
 * rather than a dead command.
 */
export async function handleFallback(ctx: Context): Promise<void> {
  await ctx.reply(
    'Everything happens inside the app now.',
    Markup.inlineKeyboard([[Markup.button.webApp('📖 Open BookQuest', env.WEB_APP_URL)]])
  );
}
