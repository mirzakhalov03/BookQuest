import type { ResultEntry } from '@bookquest/shared';
import { ParticipantNumeral } from '@/components/ui/ParticipantNumeral';
import { formatDuration } from '@/lib/format';

/**
 * One ranked row. `rank` and `number` both come straight off the entry — the
 * frontend renders the server's ranking, it never derives one (spec §4 rule
 * 4). Score and duration share a cell rather than each getting a grid column
 * of their own: four columns hold on a 390px screen, five don't.
 */
export function LeaderboardRow({ entry }: { entry: ResultEntry }) {
  return (
    <li className="leaderboard-row">
      <span className="leaderboard-row__rank">{entry.rank}</span>
      <ParticipantNumeral value={entry.number} className="leaderboard-row__number" />
      <span className="leaderboard-row__name">{entry.fullName}</span>
      <span className="leaderboard-row__meta">
        {entry.score}/{entry.total} · {formatDuration(entry.durationMs)}
      </span>
    </li>
  );
}
