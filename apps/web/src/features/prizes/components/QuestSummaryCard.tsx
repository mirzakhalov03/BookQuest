import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { Trophy } from 'lucide-react';
import { PRIZE_PLACES, type QuestSummary } from '@bookquest/shared';
import { BookCover } from '@/components/BookCover';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { formatCount, formatParticipantNumber } from '@/lib/format';
import { useT } from '@/i18n';

/**
 * A thumbnail, not the stage's book — `--book-w` is overridden locally so the
 * one drawn cover scales down instead of a second copy being drawn.
 *
 * `height` is set explicitly too, not left to `.cover-box`'s `var(--book-h)`.
 * `--book-h: calc(var(--book-w) * 1.47)` is declared once, on `:root`, and
 * custom properties are substituted at computed-value time on the element
 * that declares them — a descendant inherits `--book-h` already resolved
 * against `:root`'s `--book-w`, so overriding `--book-w` alone here changes
 * nothing about it. This is spec behaviour, not a Chromium quirk. Confirmed
 * via getComputedStyle: the override reached `width` (which reads `--book-w`
 * directly on this same element) but `height` kept resolving against
 * `:root`'s `--book-w`, so the thumbnail came out full stage-book height on a
 * shrunk width. Redeclaring `--book-h` in this same scope would re-derive it;
 * overriding `height` directly, in real px/rem, sidesteps the chain entirely.
 */
const THUMB_W_REM = 3.5;
const THUMB_STYLE = {
  '--book-w': `${THUMB_W_REM}rem`,
  height: `${THUMB_W_REM * 1.47}rem`
} as CSSProperties;

export function QuestSummaryCard({ quest }: { quest: QuestSummary }) {
  const t = useT();
  // 1st–3rd only; the edition page has all five.
  const topPrizes = PRIZE_PLACES.slice(0, 3)
    .map(({ key }) => quest.prizes[key])
    .filter(Boolean)
    .join(' · ');
  return (
    <Link
      to={`/quests/${quest.edition}`}
      className="group flex items-center gap-4 border-b border-[var(--rule)] py-5 last:border-none"
    >
      <div className="cover-box" style={THUMB_STYLE}>
        <BookCover title={quest.bookTitle} author={quest.bookAuthor} coverUrl={quest.coverUrl} lazy />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="type-label">{t.common.editionShort(quest.edition, quest.year)}</p>
        <p className="type-display text-xl text-paper">{quest.bookTitle}</p>
        <p className="text-sm text-taupe">{quest.bookAuthor}</p>
        <p className="text-sm text-taupe-dim">
          {t.common.readers(quest.participantCount, formatCount(quest.participantCount))}
          {quest.winner && (
            <>
              {' '}
              · {t.prizes.wonBy(quest.winner.fullName, formatParticipantNumber(quest.winner.number))}
            </>
          )}
        </p>
        {topPrizes && (
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-paper-dim">
            <Trophy className="size-3.5 shrink-0 text-gold" aria-hidden="true" />
            <span className="truncate">
              <span className="sr-only">{t.prizes.prizesGiven}</span>
              {topPrizes}
            </span>
          </p>
        )}
      </div>

      <ArrowIcon />
    </Link>
  );
}
