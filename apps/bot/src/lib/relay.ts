import type { Telegram } from 'telegraf';
import type { InlineKeyboardMarkup, Message, ReplyKeyboardMarkup } from 'telegraf/types';
import { escapeHtml } from './html.js';

// Telegram's caps. Measured on the escaped HTML, which over-counts — safe side.
const TEXT_LIMIT = 4096;
const CAPTION_LIMIT = 1024;

type RelayOptions = {
  replyMarkup?: InlineKeyboardMarkup | ReplyKeyboardMarkup;
  /** Body in a Telegram quote block under the header. */
  quote?: boolean;
};

const CAPTIONABLE = ['photo', 'video', 'animation', 'document', 'audio', 'voice'] as const;
const isCaptionable = (msg: Message) => CAPTIONABLE.some((kind) => kind in msg);

function withBody(header: string, body: string | undefined, quote = false): string {
  if (!body) return header;
  const safe = escapeHtml(body);
  return `${header}\n\n${quote ? `<blockquote>${safe}</blockquote>` : safe}`;
}

/**
 * Re-sends any message to another chat under an HTML header, in one message
 * when it fits, else header first with the copy replying to it. The markup
 * rides on the header-carrying message. User formatting is flattened — the
 * header's HTML can't be mixed with the original entities.
 */
export async function relay(
  telegram: Telegram,
  toChatId: number | string,
  source: Message,
  header: string,
  { replyMarkup, quote }: RelayOptions = {}
): Promise<void> {
  const from = source.chat.id;

  if ('text' in source) {
    const combined = withBody(header, source.text, quote);
    if (combined.length <= TEXT_LIMIT) {
      await telegram.sendMessage(toChatId, combined, {
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      });
      return;
    }
  } else if (isCaptionable(source)) {
    const caption = withBody(header, 'caption' in source ? source.caption : undefined, quote);
    if (caption.length <= CAPTION_LIMIT) {
      await telegram.copyMessage(toChatId, from, source.message_id, {
        caption,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      });
      return;
    }
  }

  // Too long, or a type with no caption (sticker, video note, location…).
  const head = await telegram.sendMessage(toChatId, header, {
    parse_mode: 'HTML',
    reply_markup: replyMarkup
  });
  await telegram.copyMessage(toChatId, from, source.message_id, {
    reply_parameters: { message_id: head.message_id }
  });
}
