import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import type { UserDocument } from '../models/user.model.js';
import { escapeHtml } from '../utils/html.js';
import { sendTelegramMessage } from '../utils/telegram-send.js';

/** Posts each new sign-up to the organizers' group. Fire-and-forget: never throws, never delays registering. */
export async function announceRegistration(
  participant: { number: number; fullName: string },
  user: Pick<UserDocument, 'username'>
): Promise<void> {
  if (!env.ADMIN_CHAT_ID) return;

  const text = [
    '🆕 <b>Yangi ishtirokchi ro‘yxatdan o‘tdi!</b>',
    '',
    `👤 Ism: <b>${escapeHtml(participant.fullName)}</b>`,
    `🆔 Telegram: ${user.username ? `@${escapeHtml(user.username)}` : '—'}`,
    `📋 Tartib raqami: <b>#${participant.number}</b>`
  ].join('\n');

  const outcome = await sendTelegramMessage(env.ADMIN_CHAT_ID, text, { html: true });
  if (outcome.status !== 'sent') {
    logger.warn(
      { participantNumber: participant.number, outcome: outcome.status },
      'Sign-up alert not sent'
    );
  }
}
