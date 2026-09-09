import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import type { QuestSummary } from '@bookquest/shared';
import { BookCover } from '@/components/BookCover';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { formatCount, formatOrdinalEdition, formatParticipantNumber } from '@/lib/format';

/**
 * A thumbnail, not the stage's book — `--book-w` is overridden locally so the
 * one drawn cover scales down instead of a second copy being drawn.
 *
 * `height` is set explicitly too, not left to `.cover-box`'s `var(--book-h)`.
 * `--book-h: calc(var(--book-w) * 1.47)` is declared once, on `:root`, and a
 * descendant that overrides `--book-w` does not make Chromium re-resolve that
 * inherited `--book-h` against its own value — measured via getComputedStyle:
 * the override reached `width` (which reads `--book-w` directly on this same
 * element) but `height` kept resolving against `:root`'s `--book-w`, so the
 * thumbnail came out full stage-book height on a shrunk width. Overriding
 * `height` directly, in real px/rem rather than through the derived variable,
 * sidesteps the chain entirely.
 */
const THUMB_W_REM = 3.5;
const THUMB_STYLE = {
  '--book-w': `${THUMB_W_REM}rem`,
  height: `${THUMB_W_REM * 1.47}rem`
} as CSSProperties;

export function QuestSummaryCard({ quest }: { quest: QuestSummary }) {
  return (
    <Link
      to={`/quests/${quest.edition}`}
      className="group flex items-center gap-4 border-b border-[var(--rule)] py-5 last:border-none"
    >
      <div className="cover-box" style={THUMB_STYLE}>
        <BookCover title={quest.bookTitle} author={quest.bookAuthor} coverUrl={quest.coverUrl} />
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <p className="type-label">
          {formatOrdinalEdition(quest.edition)} · {quest.year}
        </p>
        <p className="type-display text-xl text-paper">{quest.bookTitle}</p>
        <p className="text-sm text-taupe">{quest.bookAuthor}</p>
        <p className="text-sm text-taupe-dim">
          {formatCount(quest.participantCount)} readers
          {quest.winner && (
            <>
              {' '}
              · won by {quest.winner.fullName} (#{formatParticipantNumber(quest.winner.number)})
            </>
          )}
        </p>
      </div>

      <ArrowIcon />
    </Link>
  );
}
