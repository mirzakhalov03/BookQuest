import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import type { Paginated, Participant } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { adminKeys } from './adminKeys';

/**
 * Pages through `GET /admin/participants` (page/limit/total) as one growing
 * list — "Load more" works the same on a phone as a laptop. `keepPreviousData`
 * keeps the old rows up while a new search loads.
 */
export interface ParticipantFilters {
  q: string;
  limit: number;
  sort: 'number' | 'name' | 'registered';
  order: 'asc' | 'desc';
}

export function useAdminParticipants(filters: ParticipantFilters) {
  const { q, limit, sort, order } = filters;

  return useInfiniteQuery({
    queryKey: adminKeys.participants(filters),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        page: String(pageParam),
        limit: String(limit),
        sort,
        order
      });
      if (q) params.set('q', q);
      return api.get<Paginated<Participant>>(`/admin/participants?${params.toString()}`);
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
    placeholderData: keepPreviousData
  });
}
