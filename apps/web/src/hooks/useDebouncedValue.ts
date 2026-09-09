import { useEffect, useState } from 'react';

/**
 * Holds back a fast-changing value (a search input) so its dependents only
 * see it settle. The participant table search is the first caller: without
 * this, every keystroke would fire its own `/admin/participants` request.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
