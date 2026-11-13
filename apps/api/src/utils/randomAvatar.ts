import { randomInt } from 'node:crypto';
import { AVATARS, type AvatarId } from '@bookquest/shared';

/** A uniformly random mascot, so a new profile never opens on bare initials. */
export const randomAvatar = (): AvatarId => AVATARS[randomInt(AVATARS.length)]!;
