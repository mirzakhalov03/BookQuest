import { fileURLToPath } from 'node:url';
import type { Context } from 'telegraf';
import type { InputMediaPhoto, Message } from 'telegraf/types';
import { TEXTS } from '../texts.js';

/** Files in `apps/bot/assets/team/`, in display order. */
const TEAM_PHOTOS: readonly string[] = ['team-2026.png'];

// Telegram's caption cap. Measured on the raw HTML, which over-counts — safe side.
const CAPTION_LIMIT = 1024;

const HTML = { parse_mode: 'HTML', link_preview_options: { is_disabled: true } } as const;

// file_id per photo after the first upload, so later sends skip re-uploading.
const fileIds = new Map<string, string>();

// Same relative depth from src/handlers and dist/handlers.
const assetPath = (file: string) =>
  fileURLToPath(new URL(`../../assets/team/${file}`, import.meta.url));

const photoSource = (file: string) => fileIds.get(file) ?? { source: assetPath(file) };

function remember(sent: Message[]): void {
  sent.forEach((msg, i) => {
    const largest = 'photo' in msg ? msg.photo.at(-1) : undefined;
    const file = TEAM_PHOTOS[i];
    if (largest && file) fileIds.set(file, largest.file_id);
  });
}

/** Albums need 2–10 items, so a single photo goes out on its own. */
async function sendPhotos(ctx: Context, caption: string | undefined): Promise<void> {
  const captionOpts = caption ? { caption, parse_mode: 'HTML' as const } : {};

  if (TEAM_PHOTOS.length === 1) {
    remember([await ctx.replyWithPhoto(photoSource(TEAM_PHOTOS[0]!), captionOpts)]);
    return;
  }

  const album: InputMediaPhoto[] = TEAM_PHOTOS.map((file, i) => ({
    type: 'photo',
    media: photoSource(file),
    ...(i === 0 ? captionOpts : {})
  }));
  remember(await ctx.replyWithMediaGroup(album));
}

/** Photos with the text as caption; text as its own message when there are no photos or it's too long. */
export async function handleAbout(ctx: Context): Promise<void> {
  const hasPhotos = TEAM_PHOTOS.length > 0;
  const fitsCaption = TEXTS.about.length <= CAPTION_LIMIT;

  if (hasPhotos) await sendPhotos(ctx, fitsCaption ? TEXTS.about : undefined);
  if (!hasPhotos || !fitsCaption) await ctx.reply(TEXTS.about, HTML);
}
