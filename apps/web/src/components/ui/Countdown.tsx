import { useCountdown } from '@/hooks/useCountdown';
import { TimeUnit } from './TimeUnit';

interface CountdownProps {
  /** Phase-dependent copy — "Reading deadline", "Quiz closes in", "Quiz closed"… */
  label: string;
  /**
   * The instant to count down to, or `null` for a frozen clock (nothing left
   * to wait for). Must be referentially stable across renders — a fresh
   * `Date` every render restarts the ticking effect and loops. Callers own
   * that memoisation (`useMemo` on the source ISO string), not this.
   */
  target: Date | null;
  /** The line under the clock: a formatted date, or a caption like "Results published …". */
  dateText: string;
}

/**
 * The stage's clock — and, per spec §4, the results screen's too, for its
 * "results are published on…" state. Everything BookQuest-specific (which
 * date drives it, what the label says, what "done" looks like) is the
 * caller's job; this only knows how to tick and how to paint four digits.
 */
export function Countdown({ label, target, dateText }: CountdownProps) {
  const time = useCountdown(target);

  return (
    <section className="clock" aria-label="Time remaining">
      <p className="clock__label">{label}</p>

      <div className="clock__row">
        <TimeUnit unit="days" value={time.days} label="Days" />
        <TimeUnit unit="hours" value={time.hours} label="Hours" />
        <TimeUnit unit="minutes" value={time.minutes} label="Minutes" />
        <TimeUnit unit="seconds" value={time.seconds} label="Seconds" />
      </div>

      <p className="clock__date">{dateText}</p>
    </section>
  );
}
