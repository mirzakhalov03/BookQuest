import { useQuery } from '@tanstack/react-query';
import type { AdminQuest } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { adminKeys } from './adminKeys';

/** The quest editor's source: the public quest plus its quiz setup, which `/quests/current` never carries. */
export function useAdminCurrentQuest() {
  return useQuery({
    queryKey: adminKeys.currentQuest(),
    queryFn: () => api.get<AdminQuest>('/admin/quests/current')
  });
}
