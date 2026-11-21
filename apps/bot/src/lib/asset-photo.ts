import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Message } from 'telegraf/types';

/** Paths relative to `apps/bot/assets/`. Same relative depth from src/lib and dist/lib. */
export const assetPath = (file: string): string =>
  fileURLToPath(new URL(`../../assets/${file}`, import.meta.url));

export const assetExists = (file: string): boolean => existsSync(assetPath(file));

// file_id per asset after the first upload, so later sends skip re-uploading.
const fileIds = new Map<string, string>();

export const photoSource = (file: string) => fileIds.get(file) ?? { source: assetPath(file) };

/** `files[i]` is the asset behind `sent[i]`. */
export function rememberPhotos(files: readonly string[], sent: Message[]): void {
  sent.forEach((msg, i) => {
    const largest = 'photo' in msg ? msg.photo.at(-1) : undefined;
    const file = files[i];
    if (largest && file) fileIds.set(file, largest.file_id);
  });
}
