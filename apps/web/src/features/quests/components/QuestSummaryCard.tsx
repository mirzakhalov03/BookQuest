import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import type { QuestSummary } from '@bookquest/shared';
import { BookCover } from '@/components/BookCover';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { formatCount, formatOrdinalEdition, formatParticipantNumber } from '@/lib/format';

/** A thumbnail, not the stage's book — `--book-w` is overridden locally so
    the one drawn cover scales down instead of a second copy being drawn. */
const THUMB_STYLE = { '--book-w': '3.5rem' } as CSSProperties;

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
