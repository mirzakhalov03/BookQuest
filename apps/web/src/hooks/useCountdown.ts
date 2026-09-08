import { useEffect, useState } from 'react';

export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isOver: boolean;
}

function remaining(target: Date | null): TimeLeft {
  if (!target) return { days: 0, hours: 0, minutes: 0, seconds: 0, isOver: true };

  const ms = Math.max(0, target.getTime() - Date.now());
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor(ms / 3_600_000) % 24,
    minutes: Math.floor(ms / 60_000) % 60,
    seconds: Math.floor(ms / 1000) % 60,
    isOver: ms === 0
  };
}

/**
 * Recomputes from the target each tick rather than counting down a stored
 * number, so a backgrounded tab or a sleeping phone comes back showing the
 * right time instead of however far it got.
 */
export function useCountdown(target: Date | null): TimeLeft {
  const [time, setTime] = useState(() => remaining(target));

  useEffect(() => {
    setTime(remaining(target));
    if (!target) return;

    const id = window.setInterval(() => setTime(remaining(target)), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  return time;
}
