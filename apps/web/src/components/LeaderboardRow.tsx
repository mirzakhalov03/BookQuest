import type { ResultEntry } from '@bookquest/shared';
import { ParticipantNumeral } from '@/components/ui/ParticipantNumeral';
import { formatDuration } from '@/lib/format';

/**
 * One ranked row; `highlight` marks the top five. `rank` and `number` both come straight off the entry — the
 * frontend renders the server's ranking, it never derives one (spec §4 rule
 * 4). Score and duration share a cell rather than each getting a grid column
 * of their own: four columns hold on a 390px screen, five don't.
 *
 * Promoted here from `features/results/` — the admin results inspection
 * reads the exact same `QuestResults` shape and needs the exact same row,
 * so it reuses this rather than a feature importing another feature's
 * internals (spec §4 rule 1).
 */
export function LeaderboardRow({ entry, highlight = false }: { entry: ResultEntry; highlight?: boolean }) {
  return (
    <li className={highlight ? 'leaderboard-row leaderboard-row--top' : 'leaderboard-row'}>
      <span className="leaderboard-row__rank">{entry.rank}</span>
      <ParticipantNumeral value={entry.number} className="leaderboard-row__number" />
      <span className="leaderboard-row__name">{entry.fullName}</span>
      <span className="leaderboard-row__meta">
        {entry.score}/{entry.total} · {formatDuration(entry.durationMs)}
      </span>
    </li>
  );
}
