import { useEffect, useState } from 'react';

const SHOW_AFTER_MS = 2000;

/** After 2 s of failing requests (§6). The timer keeps running underneath, truthfully. */
export function ConnectionBanner({ failingSince }: { failingSince: number | null }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (failingSince === null) {
      setShown(false);
      return;
    }
    const wait = Math.max(0, failingSince + SHOW_AFTER_MS - Date.now());
    const id = window.setTimeout(() => setShown(true), wait);
    return () => window.clearTimeout(id);
  }, [failingSince]);

  if (!shown) return null;
  return (
    <p role="status" className="m-0 rounded-box border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber">
      Connection lost. Your saved answer is safe; we'll keep trying.
    </p>
  );
}
