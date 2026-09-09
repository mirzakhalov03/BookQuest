import type { ReactNode } from 'react';
import type { BookResourceKind } from '@bookquest/shared';

/**
 * One shape per `kind`. This is the whole reason the field exists (spec §3):
 * the API already knows what a resource is, so the icon is a lookup, never a
 * guess made by pattern-matching the URL.
 */
const PATHS: Record<BookResourceKind, ReactNode> = {
  pdf: (
    <>
      <path d="M6 2.5h9l5 5V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z" />
      <path d="M15 2.5V8h5" />
    </>
  ),
  epub: (
    <>
      <path d="M3 5.5c3-1.4 6-1.4 9 0v14c-3-1.4-6-1.4-9 0z" />
      <path d="M21 5.5c-3-1.4-6-1.4-9 0v14c3-1.4 6-1.4 9 0z" />
    </>
  ),
  audio: (
    <>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="2" y="15" width="5" height="6.5" rx="1.5" />
      <rect x="17" y="15" width="5" height="6.5" rx="1.5" />
    </>
  ),
  link: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
    </>
  )
};

export function ResourceIcon({ kind }: { kind: BookResourceKind }) {
  return (
    <svg
      className="h-5 w-5 shrink-0 stroke-current"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[kind]}
    </svg>
  );
}
