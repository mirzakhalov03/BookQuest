import type { ResultEntry } from '@bookquest/shared';
import { ParticipantNumeral } from '@/components/ui/ParticipantNumeral';
import { formatDuration } from '@/lib/format';

interface PodiumProps {
  /** Up to three, already ranked by the API — rendered in that order,
   * never re-sorted (spec §4 rule 4). */
  entries: ResultEntry[];
}

/**
 * Gold "used at scale" (spec §8) — the one surface in the product where it
 * covers more than a hairline or a numeral.
 *
 * `entries` renders in whatever order the API sent (rank ascending); the
 * classic 2nd–1st–3rd stand is CSS alone, `order` keyed off each place's own
 * `data-rank` — so this never reorders the array to get there, and a podium
 * of one or two (a small quiz-taker pool) degrades to a centred row instead
 * of a layout branch here.
 */
export function Podium({ entries }: PodiumProps) {
  if (entries.length === 0) return null;

  return (
    <div className="results-podium">
      {entries.map((entry) => (
        <div key={entry.number} className="results-podium__place" data-rank={entry.rank}>
          <p className="results-podium__rank type-display">{entry.rank}</p>
          <p className="results-podium__name">{entry.fullName}</p>
          <ParticipantNumeral value={entry.number} className="results-podium__number" />
          <p className="results-podium__meta">
            {entry.score}/{entry.total} · {formatDuration(entry.durationMs)}
          </p>
        </div>
      ))}
    </div>
  );
}
