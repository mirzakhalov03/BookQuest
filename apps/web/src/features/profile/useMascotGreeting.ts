import { useEffect, useState } from 'react';
import { haptic } from '@/lib/telegram';

export type GreetVariant = 'hello' | 'bounce' | 'none';

const TIP_MS = 3000;
const seenKey = (userId: string) => `bq:mascot-seen:${userId}`;

function hasSeen(userId: string): boolean {
  try {
    return window.localStorage.getItem(seenKey(userId)) !== null;
  } catch {
    // Storage blocked: treat as first time and simply don't remember it.
    return false;
  }
}

/**
 * How the mascot greets the reader on Profile: a big hello the first time
 * (per account, so a shared phone greets each reader), a small bounce after.
 * Initials don't animate.
 */
export function useMascotGreeting(
  userId: string | undefined,
  hasMascot: boolean
): { variant: GreetVariant; showTip: boolean; dismissTip: () => void } {
  // Decided once per account at mount, so saving the flag below doesn't downgrade this visit.
  const [first, setFirst] = useState(() => ({ userId, value: userId ? !hasSeen(userId) : false }));
  if (first.userId !== userId) setFirst({ userId, value: userId ? !hasSeen(userId) : false });

  const variant: GreetVariant = !hasMascot || !userId ? 'none' : first.value ? 'hello' : 'bounce';
  const [tipDismissed, setTipDismissed] = useState(false);
  const showTip = variant === 'hello' && !tipDismissed;

  useEffect(() => {
    if (variant !== 'hello' || !userId) return;
    try {
      window.localStorage.setItem(seenKey(userId), '1');
    } catch {
      // Not remembered; the hello plays again next time, which is harmless.
    }
    haptic('select');
    const timer = window.setTimeout(() => setTipDismissed(true), TIP_MS);
    return () => window.clearTimeout(timer);
  }, [variant, userId]);

  return { variant, showTip, dismissTip: () => setTipDismissed(true) };
}
