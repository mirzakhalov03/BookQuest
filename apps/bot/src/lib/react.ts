import type { Telegram } from 'telegraf';
import { logger } from '../config/logger.js';

/** A quiet "got it". Cosmetic, so a failure is only logged. */
export async function react(telegram: Telegram, chatId: number, messageId: number): Promise<void> {
  try {
    await telegram.setMessageReaction(chatId, messageId, [{ type: 'emoji', emoji: '👍' }]);
  } catch (error) {
    logger.debug({ err: error }, 'Could not react');
  }
}
