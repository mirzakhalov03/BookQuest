import type { AttemptRow } from '@bookquest/shared';
import { ParticipantNumeral } from '@/components/ui/ParticipantNumeral';
import { formatDuration } from '@/lib/format';
import { FLAG_LABEL, STATUS_LABEL } from '../attemptLabels';

interface AttemptsTableProps {
  attempts: AttemptRow[];
  onOpen: (attempt: AttemptRow) => void;
}

const progress = (a: AttemptRow) => `${a.answered}/${a.total}`;
const score = (a: AttemptRow) => (a.score === null ? '—' : `${a.score}/${a.total}`);
const time = (a: AttemptRow) => (a.durationMs === null ? '—' : formatDuration(a.durationMs));

function FlagChips({ flags }: { flags: AttemptRow['flags'] }) {
  if (flags.length === 0) return <span className="text-taupe-dim">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {flags.map((flag) => (
        <span key={flag} className="rounded-full border border-amber/50 px-2 py-0.5 text-xs text-amber">
          {FLAG_LABEL[flag]}
        </span>
      ))}
    </span>
  );
}

/** Cards on a phone, a table from `sm`; a row opens the attempt. */
export function AttemptsTable({ attempts, onOpen }: AttemptsTableProps) {
  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 sm:hidden">
        {attempts.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onOpen(a)}
              className="flex w-full flex-col gap-2 rounded-box border border-[color:var(--rule)] px-3 py-3 text-left"
            >
              <span className="flex items-baseline justify-between gap-3">
                <ParticipantNumeral hash value={a.participant.number} className="type-display text-lg text-gold" />
                <span className="text-sm text-taupe">{STATUS_LABEL[a.status]}</span>
              </span>
              <span className="text-paper">{a.participant.fullName}</span>
              <span className="text-sm text-taupe">
                {a.groupLabel} · {progress(a)} · {score(a)} · {time(a)}
              </span>
              {a.flags.length > 0 && <FlagChips flags={a.flags} />}
            </button>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[color:var(--rule-strong)] text-taupe">
              {['Number', 'Name', 'Group', 'Status', 'Progress', 'Score', 'Time', 'Flags'].map((head) => (
                <th key={head} className="type-label py-2 pr-3 font-normal">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attempts.map((a) => (
              <tr
                key={a.id}
                onClick={() => onOpen(a)}
                className="cursor-pointer border-b border-[color:var(--rule)] hover:bg-[color:var(--color-ash)]"
              >
                <td className="py-2 pr-3">
                  <ParticipantNumeral hash value={a.participant.number} className="type-display text-base text-gold" />
                </td>
                <td className="py-2 pr-3 text-paper">
                  {/* A real button, so the row is reachable by keyboard. */}
                  <button type="button" className="text-left hover:text-amber" onClick={() => onOpen(a)}>
                    {a.participant.fullName}
                  </button>
                </td>
                <td className="py-2 pr-3 text-paper-dim">{a.groupLabel}</td>
                <td className="py-2 pr-3 text-paper-dim">{STATUS_LABEL[a.status]}</td>
                <td className="py-2 pr-3 tabular-nums text-paper-dim">{progress(a)}</td>
                <td className="py-2 pr-3 tabular-nums text-paper-dim">{score(a)}</td>
                <td className="py-2 pr-3 tabular-nums text-paper-dim">{time(a)}</td>
                <td className="py-2 pr-3">
                  <FlagChips flags={a.flags} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
