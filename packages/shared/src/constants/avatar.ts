/**
 * The avatars a user can pick. Each id is also its image's filename in
 * `apps/web/src/assets/avatars/` — swapping the set means swapping both.
 */
export const AVATARS = [
  'rabbit',
  'bear',
  'chick',
  'queen',
  'cool-duck',
  'arctic-fox',
  'duck',
  'arctic-hare',
  'baby-penguin'
] as const;

export type AvatarId = (typeof AVATARS)[number];

/** A stored id can outlive its set, so reads check before trusting it. */
export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && (AVATARS as readonly string[]).includes(value);
}
