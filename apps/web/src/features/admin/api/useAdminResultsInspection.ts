import { useQuery } from '@tanstack/react-query';
import type { QuestResults } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { adminKeys } from './adminKeys';

/**
 * There is no `GET /admin/results` — the admin router mounts participants,
 * quests and stats only (`apps/api/src/routes/admin/index.ts`). This reads
 * the same public `GET /quests/current/results` the participant results
 * screen uses; "read-only result inspection" is exactly what that endpoint
 * already is, so nothing new is added to the API.
 */
export function useAdminResultsInspection() {
  return useQuery({
    queryKey: adminKeys.results(),
    queryFn: () => api.get<QuestResults>('/quests/current/results')
  });
}
