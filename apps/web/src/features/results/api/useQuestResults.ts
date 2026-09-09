import { useQuery } from '@tanstack/react-query';
import type { QuestResults } from '@bookquest/shared';
import { api } from '@/lib/api/client';

/**
 * Its own root, mirroring `questArchiveKeys` — invalidating "the published
 * results" is a different event from invalidating "the current quest", even
 * though both come from the same edition.
 */
export const resultsKeys = {
  all: ['results'] as const,
  current: () => [...resultsKeys.all, 'current'] as const
};

export function useQuestResults() {
  return useQuery({
    queryKey: resultsKeys.current(),
    queryFn: () => api.get<QuestResults>('/quests/current/results')
  });
}
