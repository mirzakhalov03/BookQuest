import { useEffect, useRef } from 'react';
import type { AttemptState } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { formatLongDate, formatStopwatch } from '@/lib/format';

interface CompletionScreenProps {
  result: NonNullable<AttemptState['result']>;
  resultsAt: string | null;
  /** Finalised by the window closing rather than the last answer. */
  closedEarly: boolean;
}

export function CompletionScreen({ result, resultsAt, closedEarly }: CompletionScreenProps) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-6 text-center">
      {!reducedMotion && <Confetti />}
      <h1 className="type-display m-0 text-5xl text-paper">Done!</h1>
      {closedEarly && (
        <p className="m-0 max-w-sm text-taupe">The quiz closed. Unanswered questions were counted as unanswered.</p>
      )}
      <div className="flex items-end gap-10">
        <Stat label="Score · provisional" value={`${result.score} / ${result.total}`} />
        <Stat label="Time" value={formatStopwatch(result.durationMs)} />
      </div>
      {resultsAt && <p className="m-0 text-paper-dim">Results are published on {formatLongDate(resultsAt)}.</p>}
      <Button to="/" variant="quiet">
        Back to Stage
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="type-display text-4xl tabular-nums text-paper">{value}</span>
      <span className="type-label">{label}</span>
    </div>
  );
}

const PIECES = 28;
const COLOURS = ['var(--color-ember)', 'var(--color-amber)', 'var(--color-gold-soft)', 'var(--color-paper)'];

/** Light, one-shot, and absent under reduced motion. Web Animations, so no global keyframes. */
function Confetti() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const animations = Array.from(ref.current?.children ?? []).map((piece, i) =>
      piece.animate(
        [
          { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
          {
            transform: `translate(${(Math.random() - 0.5) * 320}px, ${240 + Math.random() * 220}px) rotate(${Math.random() * 720}deg)`,
            opacity: 0
          }
        ],
        { duration: 1400 + Math.random() * 900, delay: i * 18, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
      )
    );
    return () => animations.forEach((animation) => animation.cancel());
  }, []);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute left-1/2 top-1/4 h-0 w-0">
      {Array.from({ length: PIECES }, (_, i) => (
        <span
          key={i}
          className="absolute block h-2 w-1.5 rounded-[1px]"
          style={{ background: COLOURS[i % COLOURS.length], opacity: 0 }}
        />
      ))}
    </div>
  );
}
