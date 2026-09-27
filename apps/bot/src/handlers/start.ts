import { Markup, type Context } from 'telegraf';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { toBotUserUpsertPayload, upsertUser } from '../lib/api-client.js';

const WELCOME =
  'Welcome to BookQuest! 📚\n\n' +
  'An annual reading competition — pick the book, read it, take the quiz. ' +
  'Speed and accuracy decide the winners, and everyone who finishes gets a ' +
  'certificate.';

/**
 * Two messages, not one: Telegram's reply_markup is either an inline
 * keyboard or a "remove the old keyboard" instruction, never both on the
 * same message. The first message clears whatever the old bot left on
 * screen; the second carries the one action that matters.
 */
export async function handleStart(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  await upsertUser(toBotUserUpsertPayload(ctx.from));

  await ctx.reply(WELCOME, Markup.removeKeyboard());
  await ctx.reply(
    'Tap below to get started.',
    Markup.inlineKeyboard([[Markup.button.webApp('📖 Open BookQuest', env.WEB_APP_URL)]])
  );

  logger.info({ telegramUserId: String(ctx.from.id) }, 'Handled /start');
}
