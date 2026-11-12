import type { QuizLiveStats } from '@bookquest/shared';
import { formatCount, formatDuration } from '@/lib/format';
import { useT } from '@/i18n';
import { localizeGroupLabel } from '../../quest/quizConfig';

type Group = QuizLiveStats['groups'][number];

/** One tile per variant: a clearly harder one shows up here first. */
export function LiveGroupTiles({ groups }: { groups: Group[] }) {
  const t = useT().adminQuiz.live;
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
      {groups.map((group) => (
        <li
          key={group.index}
          className="flex flex-col gap-3 rounded-box border border-[color:var(--rule)] bg-[color:var(--color-ash)] p-4"
        >
          <div className="min-w-0">
            <p className="type-label m-0">{localizeGroupLabel(group.label)}</p>
            <h2 className="type-display m-0 break-words text-lg text-paper">{group.quizTitle}</h2>
          </div>
          <dl className="m-0 grid grid-cols-4 gap-2">
            <Stat label={t.assigned} value={group.assigned} />
            <Stat label={t.started} value={group.started} />
            <Stat label={t.playing} value={group.inProgress} />
            <Stat label={t.done} value={group.completed} />
          </dl>
          {group.completed > 0 && group.avgScore !== null && group.avgDurationMs !== null && (
            <p className="m-0 text-sm text-taupe">
              {t.average.before}
              <span className="tabular-nums text-paper-dim">{group.avgScore.toFixed(1)}</span>
              {t.average.middle}
              <span className="tabular-nums text-paper-dim">{formatDuration(group.avgDurationMs)}</span>
              {t.average.after}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <dt className="type-label truncate text-[0.625rem]">{label}</dt>
      <dd className="type-display m-0 text-2xl tabular-nums text-paper">{formatCount(value)}</dd>
    </div>
  );
}
