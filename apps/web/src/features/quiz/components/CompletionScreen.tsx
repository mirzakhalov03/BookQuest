import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { formatLongDate } from '@/lib/format';

interface CompletionScreenProps {
  resultsAt: string | null;
  /** Finalised by the window closing rather than the last answer. */
  closedEarly: boolean;
}

/** No score here: results stay sealed until they're published for everyone at once. */
export function CompletionScreen({ resultsAt, closedEarly }: CompletionScreenProps) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-6 text-center">
      {!reducedMotion && <Confetti />}
      <h1 className="type-display m-0 text-5xl text-paper">Done!</h1>
      <p className="m-0 max-w-sm text-lg text-paper">Your answers are in and safely saved.</p>
      {closedEarly && (
        <p className="m-0 max-w-sm text-taupe">The quiz closed. Unanswered questions were counted as unanswered.</p>
      )}
      <p className="m-0 max-w-sm text-paper-dim">
        {resultsAt ? (
          <>
            Results will be announced on <span className="text-paper">{formatLongDate(resultsAt)}</span>.
          </>
        ) : (
          'Results will be announced soon.'
        )}
      </p>
      <Button to="/" variant="quiet">
        Back to Stage
      </Button>
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
