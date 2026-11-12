import { useCallback, useEffect, useRef } from 'react';

type Signals = { hiddenCount: number; hiddenMs: number };

// Schema caps (putAttemptItemSchema); the server keeps the max per question.
const MAX_COUNT = 1000;
const MAX_MS = 3_600_000;

/** Counts how often and how long the tab was hidden during the question `key`; advisory only (§12.6). */
export function useHiddenSignals(key: string | null): () => Signals {
  const ref = useRef({ key, hiddenCount: 0, hiddenMs: 0, hiddenSince: null as number | null });

  if (ref.current.key !== key) ref.current = { key, hiddenCount: 0, hiddenMs: 0, hiddenSince: null };

  useEffect(() => {
    const onChange = () => {
      const current = ref.current;
      if (current.key === null) return;
      if (document.visibilityState === 'hidden') {
        current.hiddenCount += 1;
        current.hiddenSince = Date.now();
      } else if (current.hiddenSince !== null) {
        current.hiddenMs += Date.now() - current.hiddenSince;
        current.hiddenSince = null;
      }
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  return useCallback(() => {
    const { hiddenCount, hiddenMs, hiddenSince } = ref.current;
    const ongoing = hiddenSince === null ? 0 : Date.now() - hiddenSince;
    return {
      hiddenCount: Math.min(MAX_COUNT, hiddenCount),
      hiddenMs: Math.min(MAX_MS, Math.round(hiddenMs + ongoing))
    };
  }, []);
}
