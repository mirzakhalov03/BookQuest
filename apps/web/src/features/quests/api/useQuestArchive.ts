import { useInfiniteQuery } from '@tanstack/react-query';
import type { CursorPage, QuestSummary } from '@bookquest/shared';
import { api } from '@/lib/api/client';

/**
 * Mirrors `questKeys`' shape (an `all` root plus one function per query) —
 * its own root, not a child of `questKeys.all`, because invalidating "the
 * current quest" and invalidating "the archive" are different events and a
 * shared prefix would couple them.
 */
export const questArchiveKeys = {
  all: ['questArchive'] as const,
  list: () => [...questArchiveKeys.all, 'list'] as const,
  edition: (edition: number) => [...questArchiveKeys.all, 'edition', edition] as const
};

const PAGE_SIZE = 10;

/**
 * The archive, newest edition first. `GET /quests` answers a `CursorPage` —
 * `{ items, nextCursor }`, no `page`/`limit`/`total` — because the archive can
 * grow a new edition at the top between two reads; an offset would then shift
 * every later page by one and duplicate or skip a row. `nextCursor` is an
 * opaque token (the real API base64-encodes an edition number, the mock uses
 * a plain offset) — it is only ever handed back exactly as received, never
 * parsed or incremented here.
 */
export function useQuestArchive() {
  return useInfiniteQuery({
    queryKey: questArchiveKeys.list(),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (pageParam) params.set('cursor', pageParam);
      return api.get<CursorPage<QuestSummary>>(`/quests?${params.toString()}`);
    },
    initialPageParam: undefined as string | undefined,
    // `undefined`, not `null`: React Query only reads "no more pages" from
    // `undefined` — passing the API's own `null` through would keep
    // `hasNextPage` true and "Load more" would refetch the last page forever.
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });
}
