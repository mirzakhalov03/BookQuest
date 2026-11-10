import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { handleStart } from './handlers/start.js';
import { handleFallback } from './handlers/fallback.js';
import { recordInteractionMiddleware } from './middlewares/record-interaction.js';
import { flushInteractions } from './lib/interaction-recorder.js';

const SHUTDOWN_FLUSH_MS = 3000;

async function start(): Promise<void> {
  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  // Clears the old bot's "/" command menu. Idempotent — safe on every boot.
  await bot.telegram.setMyCommands([]);

  // First: logging sees every update, matched or not.
  bot.use(recordInteractionMiddleware);

  // Registration order matters: /start must be seen before the generic text
  // handler below, or Telegraf would run both for the same message.
  bot.start(handleStart);
  bot.on(message('text'), handleFallback);

  bot.catch((error, ctx) => {
    logger.error({ error, updateType: ctx.updateType }, 'Unhandled bot error');
  });

  // Before launch(): its promise only settles when polling stops, so code after it never runs while live.
  // Stop polling first so nothing is recorded after the last flush; bounded so a dead API can't hold the exit.
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    bot.stop(signal);
    const deadline = new Promise((resolve) => setTimeout(resolve, SHUTDOWN_FLUSH_MS));
    void Promise.race([flushInteractions(), deadline]).finally(() => process.exit(0));
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  // Explicit: Telegram reuses the last caller's allowed_updates otherwise, which may lack my_chat_member.
  await bot.launch(
    { allowedUpdates: ['message', 'edited_message', 'callback_query', 'my_chat_member'] },
    () => logger.info('BookQuest bot listening (long polling)')
  );
}

start().catch((error: unknown) => {
  logger.error({ err: error }, 'Failed to start');
  process.exit(1);
});
