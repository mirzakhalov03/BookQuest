import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Paginated, Participant } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { adminKeys } from './adminKeys';

interface AdminParticipantsParams {
  q: string;
  page: number;
  limit: number;
}

/**
 * `GET /admin/participants` answers a `Paginated` — `{ items, page, limit,
 * total }` — not the `CursorPage` the public archive uses (`useQuestArchive`).
 * The two shapes exist for different reasons: the archive can grow a new
 * edition mid-scroll, so it needs a cursor; a page of participants is a
 * stable snapshot the admin is paging through by number, so `page`/`limit`
 * is the right (and simpler) contract here.
 *
 * `placeholderData: keepPreviousData` keeps the current page's rows on
 * screen while the next page loads, instead of flashing back to
 * `LoadingState` between clicks of Next.
 */
export function useAdminParticipants({ q, page, limit }: AdminParticipantsParams) {
  return useQuery({
    queryKey: adminKeys.participants({ q, page, limit }),
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q) params.set('q', q);
      return api.get<Paginated<Participant>>(`/admin/participants?${params.toString()}`);
    },
    placeholderData: keepPreviousData
  });
}
