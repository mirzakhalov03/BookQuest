import { useEffect, useRef, useState } from 'react';

const remainingAt = (deadlineMs: number, now: () => number) => Math.max(0, deadlineMs - now());

/**
 * Remaining ms until `deadlineMs`, never negative. Always derived from the
 * deadline, never decremented, so a throttled or frozen tab can't drift.
 * `now` is read through a ref: pass the server-corrected clock without memoising it.
 */
export function useCountdownTo(deadlineMs: number | null, now: () => number): number {
  const nowRef = useRef(now);
  nowRef.current = now;
  const [remaining, setRemaining] = useState(() => (deadlineMs === null ? 0 : remainingAt(deadlineMs, now)));

  useEffect(() => {
    if (deadlineMs === null) {
      setRemaining(0);
      return;
    }
    let frame = 0;
    const tick = () => {
      const next = remainingAt(deadlineMs, nowRef.current);
      setRemaining(next);
      // Stop at zero: nothing left to animate.
      if (next > 0) frame = requestAnimationFrame(tick);
    };
    // rAF is paused in hidden tabs; resync (and restart the loop) the moment we're visible.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      cancelAnimationFrame(frame);
      tick();
    };
    tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [deadlineMs]);

  return remaining;
}
