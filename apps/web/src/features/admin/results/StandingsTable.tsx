import type { StandingRow } from '@bookquest/shared';
import { ParticipantNumeral } from '@/components/ui/ParticipantNumeral';
import { formatDuration } from '@/lib/format';
import { SendSheetButton } from '../quizzes/components/SendSheetButton';

const rank = (r: StandingRow) => (r.rank === null ? '—' : String(r.rank));
const score = (r: StandingRow) => (r.score === null ? '—' : `${r.score}/${r.total}`);
const time = (r: StandingRow) => (r.durationMs === null ? '—' : formatDuration(r.durationMs));
const who = (r: StandingRow) => `#${r.participant.number} ${r.participant.fullName}`;

function Status({ row }: { row: StandingRow }) {
  if (row.status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber">
        <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber" />
        Solving {row.answered}/{row.total}
      </span>
    );
  }
  return <span className="text-paper-dim">{row.rank === null ? 'No answers' : 'Finished'}</span>;
}

/** Cards on a phone, a table from `sm`. */
export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 sm:hidden">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 rounded-box border border-[color:var(--rule)] px-3 py-3">
            <span className="type-display w-8 shrink-0 text-center text-xl tabular-nums text-gold">{rank(r)}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-paper">{r.participant.fullName}</span>
              <span className="text-sm text-taupe">
                <ParticipantNumeral hash value={r.participant.number} /> · {r.groupLabel}
              </span>
              <span className="text-sm tabular-nums">
                <Status row={r} />
                {r.status === 'completed' && (
                  <span className="text-taupe">
                    {' '}
                    · {score(r)} · {time(r)}
                  </span>
                )}
              </span>
            </span>
            <SendSheetButton attemptId={r.id} who={who(r)} />
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[color:var(--rule-strong)] text-taupe">
              {['Rank', 'Number', 'Name', 'Group', 'Score', 'Time', 'Status'].map((head) => (
                <th key={head} className="type-label py-2 pr-3 font-normal">
                  {head}
                </th>
              ))}
              <th className="py-2">
                <span className="sr-only">Answer sheet</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[color:var(--rule)]">
                <td className="type-display py-2 pr-3 text-base tabular-nums text-gold">{rank(r)}</td>
                <td className="py-2 pr-3">
                  <ParticipantNumeral hash value={r.participant.number} className="text-paper-dim" />
                </td>
                <td className="py-2 pr-3 text-paper">{r.participant.fullName}</td>
                <td className="py-2 pr-3 text-paper-dim">{r.groupLabel}</td>
                <td className="py-2 pr-3 tabular-nums text-paper">{score(r)}</td>
                <td className="py-2 pr-3 tabular-nums text-paper-dim">{time(r)}</td>
                <td className="py-2 pr-3 tabular-nums">
                  <Status row={r} />
                </td>
                <td className="py-1 text-right">
                  <SendSheetButton attemptId={r.id} who={who(r)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
