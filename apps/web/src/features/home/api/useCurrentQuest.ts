import { useQuery } from '@tanstack/react-query';
import type { Quest } from '@bookquest/shared';
import { api } from '@/lib/api/client';

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
