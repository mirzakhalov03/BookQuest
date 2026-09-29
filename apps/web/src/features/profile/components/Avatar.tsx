import type { AvatarId } from '@bookquest/shared';
import { avatarUrl } from '../avatars';

interface AvatarProps {
  name: string;
  avatar?: AvatarId | null;
  /** Width utilities; the avatar is always square. */
  className?: string;
}

/** The picked avatar, or initials in a ring until there is one. */
export function Avatar({ name, avatar, className = '' }: AvatarProps) {
  const url = avatar ? avatarUrl(avatar) : undefined;

  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`aspect-square shrink-0 object-contain drop-shadow-[0_8px_18px_rgba(10,7,5,0.45)] ${className}`}
      />
    );
  }

  // A size container, so the initials scale with whatever width the caller gives.
  return (
    <span aria-hidden="true" className={`@container block aspect-square shrink-0 ${className}`}>
      <span className="type-display flex h-full w-full items-center justify-center rounded-full border border-[color:var(--rule-gold)] bg-[color:var(--color-ash-hi)] text-[34cqw] text-gold-soft">
        {initials(name)}
      </span>
    </span>
  );
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '?';
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}
