import { BookOpen, Clapperboard, Headphones, Store, type LucideIcon } from 'lucide-react';
import { SOURCE_CARD_KINDS, type Book, type BookResource, type SourceCard } from '@bookquest/shared';

export const CARD_ICON: Record<SourceCard, LucideIcon> = {
  ebook: BookOpen,
  movie: Clapperboard,
  audio: Headphones,
  offline: Store
};

// Each card keeps its own accent so the four read apart at a glance.
export const CARD_ACCENT: Record<SourceCard, string> = {
  ebook: 'var(--color-ember)',
  movie: 'var(--color-amber)',
  audio: 'var(--color-gold)',
  offline: 'var(--color-paper-dim)'
};

export const resourcesFor = (book: Book, card: SourceCard): BookResource[] =>
  book.resources.filter((resource) => SOURCE_CARD_KINDS[card].includes(resource.kind));
