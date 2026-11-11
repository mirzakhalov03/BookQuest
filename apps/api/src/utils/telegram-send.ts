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

    return await outcomeOf(response, telegramUserId);
  } catch (error) {
    logger.warn({ telegramUserId, error }, 'Telegram send failed (network error)');
    return { status: 'failed' };
  }
}

/** Multipart sendPhoto with an optional web_app button. Same contract: never throws. */
export async function sendTelegramPhoto(
  telegramUserId: string,
  photo: { png: Buffer; fileName: string },
  caption: string,
  button?: { text: string; webAppUrl: string }
): Promise<SendOutcome> {
  try {
    const form = new FormData();
    form.set('chat_id', telegramUserId);
    form.set('caption', caption);
    form.set('photo', new Blob([new Uint8Array(photo.png)], { type: 'image/png' }), photo.fileName);
    if (button) {
      form.set(
        'reply_markup',
        JSON.stringify({ inline_keyboard: [[{ text: button.text, web_app: { url: button.webAppUrl } }]] })
      );
    }
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: form,
      // An upload takes longer than a text message.
      signal: AbortSignal.timeout(30_000)
    });
    return await outcomeOf(response, telegramUserId);
  } catch (error) {
    logger.warn({ telegramUserId, error }, 'Telegram photo send failed (network error)');
    return { status: 'failed' };
  }
}

async function outcomeOf(response: Response, telegramUserId: string): Promise<SendOutcome> {
  if (response.ok) return { status: 'sent' };
  logger.warn({ telegramUserId, status: response.status }, 'Telegram send failed');

  if (response.status === 403) return { status: 'blocked' };
  if (response.status === 429) return { status: 'rate-limited', retryAfterMs: await readRetryAfterMs(response) };
  return { status: 'failed' };
}

// Telegram puts it in the body (`parameters.retry_after`, seconds), not reliably in the header.
async function readRetryAfterMs(response: Response): Promise<number> {
  const body = (await response.json().catch(() => null)) as { parameters?: { retry_after?: number } } | null;
  const seconds = body?.parameters?.retry_after ?? Number(response.headers.get('retry-after'));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000;
}
