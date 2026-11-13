import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AdminQuest, CreateQuestPayload } from '@bookquest/shared';
import { api } from '@/lib/api/client';

export function useCreateQuest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateQuestPayload) => api.post<AdminQuest>('/admin/quests', payload),
    onSuccess: () => {
      // Not seeded into the public cache: the admin DTO carries a book the public quest may withhold.
      // A new edition changes nearly every screen: roster, results, archive, profile, stats.
      void queryClient.invalidateQueries();
    }
  });
}
