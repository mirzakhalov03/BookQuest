import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/** `blocked`: the user stopped the bot or deleted their account (403); retrying is pointless. */
export type SendOutcome =
  | { status: 'sent' }
  | { status: 'rate-limited'; retryAfterMs: number }
  | { status: 'blocked' }
  | { status: 'failed' };

/**
 * The API holds the bot token, so sending never needs apps/bot. Never throws:
 * one bad recipient must not stop the rest of a fan-out.
 */
export async function sendTelegramMessage(telegramUserId: string, text: string): Promise<SendOutcome> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramUserId, text }),
      // A hung connection would stall its worker; the timeout lands in the catch as one failed send.
      signal: AbortSignal.timeout(10_000)
    });

    if (response.ok) return { status: 'sent' };
    logger.warn({ telegramUserId, status: response.status }, 'Telegram send failed');

    if (response.status === 403) return { status: 'blocked' };
    if (response.status === 429) return { status: 'rate-limited', retryAfterMs: await readRetryAfterMs(response) };
    return { status: 'failed' };
  } catch (error) {
    logger.warn({ telegramUserId, error }, 'Telegram send failed (network error)');
    return { status: 'failed' };
  }
}

// Telegram puts it in the body (`parameters.retry_after`, seconds), not reliably in the header.
async function readRetryAfterMs(response: Response): Promise<number> {
  const body = (await response.json().catch(() => null)) as { parameters?: { retry_after?: number } } | null;
  const seconds = body?.parameters?.retry_after ?? Number(response.headers.get('retry-after'));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000;
}
