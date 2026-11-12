import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client';
import { ApiRequestError } from './api/client';

const DAY = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Must outlive the persisted copy, or a restored query is collected before anything reads it.
      gcTime: DAY,
      refetchOnWindowFocus: false,
      // A 404 or a validation failure will not fix itself on retry.
      retry: (failureCount, error) => {
        if (error instanceof ApiRequestError && error.status < 500) return false;
        return failureCount < 2;
      }
    }
  }
});

// Only these roots survive a reload: the admin console and the current quest repaint from the last visit, then refetch.
const PERSISTED_ROOTS = new Set(['admin', 'quests']);

// Some webviews throw on `localStorage` access; no storage just means no persistence.
function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const persister = createSyncStoragePersister({ storage: safeLocalStorage(), key: 'bookquest.cache' });

export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister,
  maxAge: DAY,
  // Bump on a breaking change to a cached response shape.
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' && PERSISTED_ROOTS.has(String(query.queryKey[0]))
  }
};

/** On sign-out or an account switch: admin data must not outlive the session that fetched it. */
export function forgetPrivateCache(): void {
  queryClient.removeQueries({ queryKey: ['admin'] });
  void persister.removeClient();
}
