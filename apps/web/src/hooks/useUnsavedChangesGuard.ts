import { useCallback, useEffect, useRef } from 'react';
import { useBlocker, type Blocker, type BlockerFunction } from 'react-router';

/**
 * Holds in-app navigation while `isDirty`, and asks the browser to confirm a
 * reload or tab close. Telegram's own close confirmation is already on
 * globally (`initTelegram`). `bypass()` is for "saved, now leaving": it's a
 * ref, so it takes effect before the next render can clear `isDirty`.
 */
export function useUnsavedChangesGuard(isDirty: boolean): { blocker: Blocker; bypass: () => void } {
  const bypassed = useRef(false);

  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      isDirty && !bypassed.current && currentLocation.pathname !== nextLocation.pathname,
    [isDirty]
  );
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const bypass = useCallback(() => {
    bypassed.current = true;
  }, []);

  return { blocker, bypass };
}
