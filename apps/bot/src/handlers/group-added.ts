import type { Context } from 'telegraf';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { TEXTS } from '../texts.js';

const PRESENT = new Set(['member', 'administrator']);

/** Setup helper: on joining a group that isn't the feedback group yet, post its ID there. */
export async function handleGroupAdded(ctx: Context): Promise<void> {
  const change = ctx.myChatMember;
  if (!change || change.chat.type === 'private' || change.chat.type === 'channel') return;

  const joined =
    PRESENT.has(change.new_chat_member.status) && !PRESENT.has(change.old_chat_member.status);
  if (!joined || String(change.chat.id) === env.ADMIN_CHAT_ID) return;

  logger.info({ chatId: change.chat.id, title: change.chat.title }, 'Added to a group');
  await ctx.telegram.sendMessage(change.chat.id, TEXTS.groupChatId(change.chat.id), {
    parse_mode: 'HTML'
  });
}
