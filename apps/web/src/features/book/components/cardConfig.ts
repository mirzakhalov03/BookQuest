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

/** The cards readers see, in order. Audio isn't offered for now; its data stays so it can return. */
export const SHOWN_CARDS: readonly SourceCard[] = ['ebook', 'movie', 'offline'];

// Cards whose steps stand on their own (an app to install, shops to ask), so they open even with no links.
export const SELF_CONTAINED: ReadonlySet<SourceCard> = new Set(['ebook', 'offline']);
