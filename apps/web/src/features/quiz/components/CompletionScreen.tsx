import { useMemo } from 'react';
import { CalendarClock, Gift, House } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCountdown } from '@/hooks/useCountdown';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { formatLongDate } from '@/lib/format';
import { ConfettiCanvas } from './ConfettiCanvas';

interface CompletionScreenProps {
  resultsAt: string | null;
  /** Finalised by the window closing rather than the last answer. */
  closedEarly?: boolean;
  reviewAvailable?: boolean;
}

/** The finish line: celebrate, say when results land, and point to what's next. No score: results stay sealed. */
export function CompletionScreen({ resultsAt, closedEarly = false, reviewAvailable = false }: CompletionScreenProps) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-8 py-6 text-center">
      {!reducedMotion && <ConfettiCanvas />}

      <header className="done-rise relative z-10 flex flex-col items-center gap-3">
        <span aria-hidden className="done-popper text-7xl leading-none">
          🎉
        </span>
        <p className="type-label m-0 text-ember">Quiz complete</p>
        <h1 className="type-display m-0 text-5xl text-paper">You did it!</h1>
        <p className="m-0 max-w-xs text-lg text-paper-dim">
          Every answer is locked in and safely saved. That was the big one — well read.
        </p>
        {closedEarly && (
          <p className="m-0 max-w-xs text-sm text-taupe">The quiz closed before the end, so unanswered questions count as unanswered.</p>
        )}
      </header>

      <ResultsCard resultsAt={resultsAt} />

      <nav className="done-rise done-rise--late relative z-10 flex w-full max-w-xs flex-col gap-3">
        <Button to="/" className="min-h-14 gap-2 text-base">
          <House aria-hidden className="h-5 w-5" />
          Back to home
        </Button>
        <Button to="/prizes" variant="gold" className="min-h-14 gap-2 text-base">
          <Gift aria-hidden className="h-5 w-5" />
          See what you could win
        </Button>
        {reviewAvailable && (
          <Button to="/quiz/review" variant="quiet">
            Review your answers
          </Button>
        )}
      </nav>
    </div>
  );
}

/** The one date that matters now, with a live countdown so it reads as "soon", not as a fact to remember. */
function ResultsCard({ resultsAt }: { resultsAt: string | null }) {
  const target = useMemo(() => (resultsAt ? new Date(resultsAt) : null), [resultsAt]);
  const left = useCountdown(target);
  const parts = [
    left.days > 0 && `${left.days}d`,
    (left.days > 0 || left.hours > 0) && `${left.hours}h`,
    `${left.minutes}m`,
    left.days === 0 && `${String(left.seconds).padStart(2, '0')}s`
  ].filter(Boolean);

  return (
    <section className="done-rise done-rise--mid relative z-10 flex w-full max-w-xs flex-col items-center gap-2 rounded-box border border-gold/40 bg-ash/80 px-5 py-5 shadow-[0_20px_50px_-24px_rgba(200,162,74,0.55)] backdrop-blur-sm">
      <p className="type-label m-0 flex items-center gap-2 text-gold-soft">
        <CalendarClock aria-hidden className="h-4 w-4" />
        Results revealed
      </p>
      {target ? (
        <>
          <p className="type-display m-0 text-2xl text-paper">{formatLongDate(target)}</p>
          <p className="m-0 tabular-nums text-paper-dim">in {parts.join(' ')}</p>
        </>
      ) : (
        <p className="type-display m-0 text-2xl text-paper">Very soon</p>
      )}
      <p className="m-0 text-sm text-taupe">Everyone sees the leaderboard at the same moment.</p>
    </section>
  );
}
