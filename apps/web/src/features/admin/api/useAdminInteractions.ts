import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { InteractionFacets, InteractionList } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { rangeFrom, toQueryParams, type InteractionFilters } from '../interactions/filters';
import { adminKeys } from './adminKeys';

const NEW_POLL_MS = 30_000;

/** The list query's params — also its cache key, so the page can reset exactly this query. */
export function interactionListParams(filters: InteractionFilters, limit: number) {
  return { ...toQueryParams(filters), limit: String(limit) };
}

/** Cursor pages: new rows land on top while the organiser scrolls, which would shift numbered pages. */
export function useAdminInteractions(
  filters: InteractionFilters,
  limit = 50,
  options: { enabled?: boolean } = {}
) {
  const params = interactionListParams(filters, limit);
  return useInfiniteQuery({
    queryKey: adminKeys.interactions(params),
    queryFn: ({ pageParam }) => {
      const search = new URLSearchParams(params);
      if (pageParam) search.set('cursor', pageParam);
      return api.get<InteractionList>(`/admin/interactions?${search.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true
  });
}

/** Counts rows newer than the top one. Polls only while the tab is visible (React Query's default). */
export function useNewInteractionCount(filters: InteractionFilters, headCursor: string | null) {
  const params = { ...toQueryParams(filters), since: headCursor ?? '', limit: '100' };
  return useQuery({
    queryKey: adminKeys.interactionsNew(params),
    queryFn: () =>
      api.get<InteractionList>(`/admin/interactions?${new URLSearchParams(params).toString()}`),
    enabled: headCursor !== null && filters.order === 'newest',
    refetchInterval: NEW_POLL_MS,
    select: (data) => data.items.length
  });
}

export function useInteractionFacets(filters: InteractionFilters) {
  const from = rangeFrom(filters.range);
  const params: Record<string, string> = {
    ...(from ? { from } : {}),
    ...(filters.includeAdmins ? { includeAdmins: 'true' } : {})
  };
  return useQuery({
    queryKey: adminKeys.interactionFacets(params),
    queryFn: () =>
      api.get<InteractionFacets>(
        `/admin/interactions/facets?${new URLSearchParams(params).toString()}`
      ),
    staleTime: 60_000
  });
}
