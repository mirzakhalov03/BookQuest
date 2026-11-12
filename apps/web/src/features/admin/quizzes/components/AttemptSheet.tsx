import type { AttemptAdmin } from '@bookquest/shared';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { formatCompactDate, formatDuration } from '@/lib/format';
import { useQuizAttempt } from '../../api/useQuizLive';
import { FLAG_LABEL, OUTCOME_LABEL, STATUS_LABEL } from '../attemptLabels';

type Item = AttemptAdmin['items'][number];

interface AttemptSheetProps {
  id: string | null;
  who: string;
  canVoid: boolean;
  onClose: () => void;
  onVoid: () => void;
}

const clock = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

/** Admin-only: the answer key is shown, so the sheet can read as an audit. */
export function AttemptSheet({ id, who, canVoid, onClose, onVoid }: AttemptSheetProps) {
  const attempt = useQuizAttempt(id);
  const data = attempt.data;

  return (
    <Sheet
      wide
      open={id !== null}
      onClose={onClose}
      title={who}
      actions={
        <>
          <Button type="button" variant="quiet" onClick={onClose}>
            Close
          </Button>
          {data && data.status !== 'voided' && canVoid && (
            <Button type="button" onClick={onVoid}>
              Void attempt
            </Button>
          )}
        </>
      }
    >
      {attempt.error && !data ? (
        <ErrorState error={attempt.error} onRetry={() => void attempt.refetch()} />
      ) : !data ? (
        <LoadingState label="Opening the attempt…" />
      ) : (
        <Detail attempt={data} />
      )}
    </Sheet>
  );
}

function Detail({ attempt }: { attempt: AttemptAdmin }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-sm text-taupe">
        <p className="m-0">
          {STATUS_LABEL[attempt.status]} · {attempt.groupLabel} · “{attempt.quizTitle}” · started{' '}
          {formatCompactDate(attempt.startedAt)}
        </p>
        <p className="m-0">
          {attempt.answered}/{attempt.total} answered
          {attempt.score !== null && <> · score {attempt.score}/{attempt.total}</>}
          {attempt.durationMs !== null && <> · {formatDuration(attempt.durationMs)}</>} · {attempt.clientIdCount}{' '}
          {attempt.clientIdCount === 1 ? 'device' : 'devices'}
        </p>
        {attempt.flags.length > 0 && (
          <p className="m-0 text-amber">Flags: {attempt.flags.map((flag) => FLAG_LABEL[flag]).join(', ')}</p>
        )}
        {attempt.status === 'voided' && (
          <p className="m-0 text-error">
            Voided{attempt.voidedAt ? ` ${formatCompactDate(attempt.voidedAt)}` : ''}: {attempt.voidReason}
          </p>
        )}
      </div>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {attempt.items.map((item) => (
          <ItemRow key={item.index} item={item} />
        ))}
      </ol>
    </div>
  );
}

function ItemRow({ item }: { item: Item }) {
  const mark = item.isCorrect === null ? '' : item.isCorrect ? '✓' : '✗';
  return (
    <li className="flex flex-col gap-2 rounded-box border border-[color:var(--rule)] p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="type-label">Question {item.index + 1}</span>
        <span className="tabular-nums text-taupe">
          {item.outcome ? OUTCOME_LABEL[item.outcome] : 'Pending'}
          {item.elapsedMs !== null && <> · {formatDuration(item.elapsedMs)}</>}
          {mark && <span className={item.isCorrect ? ' text-gold-soft' : ' text-error'}> {mark}</span>}
          {item.voided && ' · question voided'}
        </span>
      </div>
      <p className="m-0 text-paper">{item.prompt}</p>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
        {item.options.map((option) => {
          const correct = option.id === item.correctOptionId;
          const picked = option.id === item.selectedOptionId;
          return (
            <li
              key={option.id}
              className={`flex justify-between gap-2 rounded px-2 py-1 ${correct ? 'bg-[color:var(--color-ash-hi)] text-gold-soft' : 'text-paper-dim'}`}
            >
              <span>{option.text}</span>
              <span className="shrink-0 text-xs text-taupe">
                {correct && 'Correct'}
                {correct && picked && ' · '}
                {picked && 'Chosen'}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="m-0 text-xs tabular-nums text-taupe">
        Served {clock(item.servedAt)} · chosen {clock(item.selectedAt)} · locked {clock(item.lockedAt)}
        {(item.signals.hiddenCount > 0 || item.signals.hiddenMs > 0) &&
          ` · left the app ${item.signals.hiddenCount}× for ${formatDuration(item.signals.hiddenMs)}`}
      </p>
    </li>
  );
}
