import type { Context } from 'telegraf';
import type { InputMediaPhoto } from 'telegraf/types';
import { TEXTS } from '../texts.js';
import { photoSource, rememberPhotos } from '../lib/asset-photo.js';

/** Files in `apps/bot/assets/`, in display order. */
const TEAM_PHOTOS: readonly string[] = ['team/team-2026.png'];

// Telegram's caption cap. Measured on the raw HTML, which over-counts — safe side.
const CAPTION_LIMIT = 1024;

const HTML = { parse_mode: 'HTML', link_preview_options: { is_disabled: true } } as const;

/** Albums need 2–10 items, so a single photo goes out on its own. */
async function sendPhotos(ctx: Context, caption: string | undefined): Promise<void> {
  const captionOpts = caption ? { caption, parse_mode: 'HTML' as const } : {};

  if (TEAM_PHOTOS.length === 1) {
    rememberPhotos(TEAM_PHOTOS, [await ctx.replyWithPhoto(photoSource(TEAM_PHOTOS[0]!), captionOpts)]);
    return;
  }

  const album: InputMediaPhoto[] = TEAM_PHOTOS.map((file, i) => ({
    type: 'photo',
    media: photoSource(file),
    ...(i === 0 ? captionOpts : {})
  }));
  rememberPhotos(TEAM_PHOTOS, await ctx.replyWithMediaGroup(album));
}

/** Photos with the text as caption; text as its own message when there are no photos or it's too long. */
export async function handleAbout(ctx: Context): Promise<void> {
  const hasPhotos = TEAM_PHOTOS.length > 0;
  const fitsCaption = TEXTS.about.length <= CAPTION_LIMIT;

  if (hasPhotos) await sendPhotos(ctx, fitsCaption ? TEXTS.about : undefined);
  if (!hasPhotos || !fitsCaption) await ctx.reply(TEXTS.about, HTML);
}
