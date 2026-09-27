import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { handleStart } from './handlers/start.js';
import { handleFallback } from './handlers/fallback.js';

async function start(): Promise<void> {
  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  // Clears the old bot's "/" command menu. Idempotent — safe on every boot.
  await bot.telegram.setMyCommands([]);

  // Registration order matters: /start must be seen before the generic text
  // handler below, or Telegraf would run both for the same message.
  bot.start(handleStart);
  bot.on(message('text'), handleFallback);

  bot.catch((error, ctx) => {
    logger.error({ error, updateType: ctx.updateType }, 'Unhandled bot error');
  });

  await bot.launch();
  logger.info('BookQuest bot listening (long polling)');

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    bot.stop(signal);
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error: unknown) => {
  logger.error({ err: error }, 'Failed to start');
  process.exit(1);
});
