import { useState, type CSSProperties } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Book, SourceCard } from '@bookquest/shared';
import { haptic } from '@/lib/telegram';
import { useT } from '@/i18n';
import { CARD_ACCENT, CARD_ICON, SELF_CONTAINED, SHOWN_CARDS, resourcesFor } from './cardConfig';
import { SourceSheet } from './SourceSheet';

/** The four ways to get the book. An empty one stays visible but dimmed, so readers know it's coming. */
export function SourceCards({ book }: { book: Book }) {
  const t = useT().book.cards;
  const [open, setOpen] = useState<SourceCard | null>(null);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-label m-0">{t.heading}</h2>
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 lg:grid-cols-3">
        {SHOWN_CARDS.map((card) => {
          const count = resourcesFor(book, card).length;
          const Icon = CARD_ICON[card];
          // Admin-written steps or self-contained defaults are worth opening even without links.
          const empty = count === 0 && !SELF_CONTAINED.has(card) && !book.guides[card];
          return (
            <li key={card}>
              <button
                type="button"
                aria-disabled={empty}
                onClick={() => {
                  if (empty) return;
                  haptic('select');
                  setOpen(card);
                }}
                style={{ '--accent': CARD_ACCENT[card] } as CSSProperties}
                className={`group flex h-[100px] w-full items-center gap-4 rounded-box border border-[color:var(--rule)] bg-ash px-4 text-left transition-[transform,background-color,border-color] duration-150 ${
                  empty
                    ? 'cursor-default opacity-50'
                    : 'hover:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] hover:bg-ash-hi active:scale-[0.98]'
                }`}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-box bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[color:var(--accent)]">
                  <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium text-paper">{t[card].title}</span>
                  <span className="text-sm text-taupe">{t[card].hint}</span>
                  {(empty || count > 0) && (
                    <span className="text-xs text-taupe-dim">{empty ? t.empty : t.places(count)}</span>
                  )}
                </span>
                {!empty && (
                  <ChevronRight
                    className="h-5 w-5 shrink-0 text-taupe transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <SourceSheet book={book} card={open} onClose={() => setOpen(null)} />
    </section>
  );
}
