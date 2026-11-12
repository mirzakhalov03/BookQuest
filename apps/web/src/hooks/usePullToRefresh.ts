import { useEffect } from 'react';
import { usePullRefreshStore } from '@/stores/pullRefresh.store';

/** Lets a pull from the top refetch this screen's active queries (the gesture lives in `useOverscroll`). */
export function usePullToRefresh(): void {
  const claim = usePullRefreshStore((state) => state.claim);
  useEffect(claim, [claim]);
}
