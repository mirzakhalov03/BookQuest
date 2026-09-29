import { useQuery } from '@tanstack/react-query';
import type { BroadcastList } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { adminKeys } from './adminKeys';

const POLL_MS = 2000;

export function useBroadcasts() {
  return useQuery({
    queryKey: adminKeys.broadcasts(),
    queryFn: () => api.get<BroadcastList>('/admin/broadcasts'),
    // Poll only while a delivery is running; an idle outbox costs nothing.
    refetchInterval: (query) => (query.state.data?.items.some((item) => item.status === 'sending') ? POLL_MS : false)
  });
}
