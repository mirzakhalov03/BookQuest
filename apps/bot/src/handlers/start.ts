import type { Context } from 'telegraf';
import { logger } from '../config/logger.js';
import { toBotUserUpsertPayload, upsertUser } from '../lib/api-client.js';
import { assetExists, photoSource, rememberPhotos } from '../lib/asset-photo.js';
import { closeFeedbackSession } from '../lib/feedback-state.js';
import { escapeHtml } from '../lib/html.js';
import { mainKeyboard, startKeyboard } from '../keyboards.js';
import { TEXTS } from '../texts.js';

/** Season poster in `apps/bot/assets/`; swap the file each season. */
const POSTER = 'season/poster.jpg';

// Checked once: without the file, the pitch still goes out as plain text.
const hasPoster = assetExists(POSTER);
if (!hasPoster) logger.warn({ file: POSTER }, 'Season poster missing; /start sends text only');

/**
 * Two messages, not one: a message carries either a reply keyboard or an
 * inline keyboard, never both. The first greets and pins the bottom menu;
 * the second pitches the season and carries the actions.
 */
export async function handleStart(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  // /start is the reset: it re-sends the main keyboard, so the feedback chat ends with it.
  closeFeedbackSession(ctx.from.id);
  await upsertUser(toBotUserUpsertPayload(ctx.from));

  await ctx.reply(TEXTS.welcome(escapeHtml(ctx.from.first_name)), {
    parse_mode: 'HTML',
    ...mainKeyboard
  });

  const pitch = { parse_mode: 'HTML' as const, ...startKeyboard };
  if (hasPoster) {
    const sent = await ctx.replyWithPhoto(photoSource(POSTER), { caption: TEXTS.season, ...pitch });
    rememberPhotos([POSTER], [sent]);
  } else {
    await ctx.reply(TEXTS.season, pitch);
  }

  logger.info({ telegramUserId: String(ctx.from.id) }, 'Handled /start');
}
