import type { Telegram } from 'telegraf';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { TEXTS } from '../texts.js';

/*
 * Telegram stores the menu button; it isn't read from our env. Only production writes it:
 * a local run shares the bot token, and its tunnel URL would replace everyone's button
 * with one that dies when the tunnel does.
 */
const canWrite = env.NODE_ENV === 'production';
const menuButton = { type: 'web_app', text: TEXTS.menuButton, web_app: { url: env.WEB_APP_URL } } as const;

/** Boot: the default every chat inherits. Logs what Telegram ends up holding. */
export async function syncDefaultMenuButton(telegram: Telegram): Promise<void> {
  if (canWrite) await telegram.setChatMenuButton({ menuButton });
  const current = await telegram.getChatMenuButton({});
  logger.info({ menuButton: current, wrote: canWrite }, 'Chat menu button');
}

/** /start: clears any per-chat override (e.g. one an older bot set), so this chat follows the default. */
export async function syncChatMenuButton(telegram: Telegram, chatId: number): Promise<void> {
  if (!canWrite) return;
  try {
    await telegram.setChatMenuButton({ chatId, menuButton });
  } catch (error) {
    // A blocked chat answers 403; the button simply can't be set there.
    logger.warn({ err: error, chatId }, 'Could not set the chat menu button');
  }
}
