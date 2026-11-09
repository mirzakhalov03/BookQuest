import { useEffect, useRef, useState } from 'react';

export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function remaining(target: Date | null): TimeLeft {
  if (!target) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

  const ms = Math.max(0, target.getTime() - Date.now());
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor(ms / 3_600_000) % 24,
    minutes: Math.floor(ms / 60_000) % 60,
    seconds: Math.floor(ms / 1000) % 60
  };
}

// Fire a beat after zero, so a phone clock slightly ahead of the server doesn't refetch the old phase.
const COMPLETE_GRACE_MS = 1500;

/**
 * Recomputes from the target each tick rather than counting down a stored
 * number, so a backgrounded tab or a sleeping phone comes back showing the
 * right time instead of however far it got. `onComplete` fires once when a
 * running countdown ends — never on mount for a target already past.
 */
export function useCountdown(target: Date | null, onComplete?: () => void): TimeLeft {
  const [time, setTime] = useState(() => remaining(target));
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setTime(remaining(target));
    if (!target || target.getTime() + COMPLETE_GRACE_MS <= Date.now()) return;

    const id = window.setInterval(() => {
      setTime(remaining(target));
      if (Date.now() >= target.getTime() + COMPLETE_GRACE_MS) {
        window.clearInterval(id);
        onCompleteRef.current?.();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  return time;
}
