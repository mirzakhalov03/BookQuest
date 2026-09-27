import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * The API already holds the bot token — for sending, it never needs
 * apps/bot in the loop (Approach A: the bot process handles inbound updates
 * only). Returns whether the send succeeded rather than throwing: one
 * blocked or deactivated recipient must never stop the rest of a fan-out.
 */
export async function sendTelegramMessage(telegramUserId: string, text: string): Promise<boolean> {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: telegramUserId, text })
  });

  if (!response.ok) {
    logger.warn({ telegramUserId, status: response.status }, 'Telegram send failed');
  }

  return response.ok;
}
