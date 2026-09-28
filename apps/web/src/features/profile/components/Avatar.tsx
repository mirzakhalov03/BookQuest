import { CircleUserRound } from 'lucide-react';

/** The header's placeholder — a generic silhouette, not a real photo. */
export function Avatar() {
  return (
    <CircleUserRound
      className="h-36 w-36 rounded-full border border-[color:var(--rule)] bg-[color:var(--color-ash-hi)] p-7 text-taupe"
      strokeWidth={1.6}
      aria-hidden="true"
    />
  );
}
