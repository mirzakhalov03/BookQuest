import { AVATARS, type AvatarId } from '@bookquest/shared';

// Bundled rather than in `public/` so each file gets a content hash and caches forever.
const files = import.meta.glob<string>('../../assets/avatars/*.webp', {
  eager: true,
  query: '?url',
  import: 'default'
});

/** Undefined if the set lists an id with no image yet — callers fall back to initials. */
export function avatarUrl(id: AvatarId): string | undefined {
  return files[`../../assets/avatars/${id}.webp`];
}

/** Only the avatars that actually have an image, in the shared list's order. */
export const AVATAR_OPTIONS = AVATARS.filter((id) => avatarUrl(id) !== undefined);

/** "arctic-fox" → "Arctic fox", for screen readers. */
export function avatarLabel(id: AvatarId): string {
  const words = id.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
