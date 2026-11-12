import { useT, type Messages } from '@/i18n';

interface QuestionTimerProps {
  remainingMs: number;
  totalMs: number;
}

const SIZE = 64;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Only 10 s and 0 s are announced; a per-second live region would drown a screen reader. */
function announcement(seconds: number, t: Messages['quiz']): string {
  if (seconds === 0) return t.timesUp;
  return seconds === 10 ? t.tenSecondsLeft : '';
}

export function QuestionTimer({ remainingMs, totalMs }: QuestionTimerProps) {
  const seconds = Math.ceil(remainingMs / 1000);
  const t = useT();
  const fraction = totalMs > 0 ? Math.min(1, remainingMs / totalMs) : 0;
  const tone = remainingMs < 5000 ? 'text-ember' : remainingMs < 10_000 ? 'text-amber' : 'text-paper';

  return (
    <div className={`relative grid shrink-0 place-items-center ${tone}`} style={{ width: SIZE, height: SIZE }}>
      <svg aria-hidden width={SIZE} height={SIZE} className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-paper/15" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
        />
      </svg>
      <span aria-hidden className="absolute text-lg font-semibold tabular-nums">
        {seconds}
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement(seconds, t.quiz)}
      </span>
    </div>
  );
}
