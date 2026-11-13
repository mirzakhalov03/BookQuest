import { useCallback } from 'react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type QueryClient
} from '@tanstack/react-query';
import type { CursorPage, Quest, QuestSummary } from '@bookquest/shared';
import { api } from './client';

// The current quest and the archive. In `lib/` because many features read them (spec §4 rule 1).

export const questKeys = {
  all: ['quests'] as const,
  current: () => [...questKeys.all, 'current'] as const
};

export function useCurrentQuest() {
  return useQuery({
    queryKey: questKeys.current(),
    queryFn: () => api.get<Quest>('/quests/current')
  });
}

/** When a phase ends: refetch past the HTTP cache, which would still hold the old phase. */
export function useRefreshCurrentQuest(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => void fetchCurrentQuestFresh(queryClient), [queryClient]);
}

/**
 * Past the 30s HTTP cache, for moments a person expects news: a phase ending,
 * a pull-to-refresh, an admin save (a book reveal must not come back as "?").
 */
export function fetchCurrentQuestFresh(queryClient: QueryClient): Promise<unknown> {
  return (
    queryClient
      .fetchQuery({
        queryKey: questKeys.current(),
        queryFn: () => api.get<Quest>('/quests/current', { cache: 'no-cache' }),
        staleTime: 0
      })
      // Same as refetchQueries: a failure shows in the screen's own error state.
      .catch(() => undefined)
  );
}

// Own root, not under `questKeys.all`: invalidating the current quest and the archive are different events.
export const questArchiveKeys = {
  all: ['questArchive'] as const,
  list: () => [...questArchiveKeys.all, 'list'] as const,
  edition: (edition: number) => [...questArchiveKeys.all, 'edition', edition] as const
};

const PAGE_SIZE = 10;

/** Newest first. Cursor, not offset: a new edition at the top would shift every page. The cursor is opaque. */
export function useQuestArchive() {
  return useInfiniteQuery({
    queryKey: questArchiveKeys.list(),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (pageParam) params.set('cursor', pageParam);
      return api.get<CursorPage<QuestSummary>>(`/quests?${params.toString()}`);
    },
    initialPageParam: undefined as string | undefined,
    // `undefined`, not `null`: React Query only treats `undefined` as "no more pages".
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });
}
