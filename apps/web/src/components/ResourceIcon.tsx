import { FileText, BookOpen, Headphones, Link2, Store } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { BookResourceKind } from '@bookquest/shared';

/**
 * One icon per `kind`. This is the whole reason the field exists (spec §3):
 * the API already knows what a resource is, so the icon is a lookup, never a
 * guess made by pattern-matching the URL.
 */
export const RESOURCE_ICONS: Record<BookResourceKind, LucideIcon> = {
  pdf: FileText,
  epub: BookOpen,
  audio: Headphones,
  link: Link2,
  store: Store
};

export function ResourceIcon({ kind, className = 'h-5 w-5' }: { kind: BookResourceKind; className?: string }) {
  const Icon = RESOURCE_ICONS[kind];
  return <Icon className={`${className} shrink-0`} strokeWidth={1.6} aria-hidden="true" />;
}
